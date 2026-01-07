import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Shopkeeper, ShopkeeperDocument } from "./schemas/shopkeeper.schema";
import { LoginDto } from "../admin/dto/login.dto";
import * as bcrypt from "bcrypt";
import { JwtService } from "@nestjs/jwt";
import { MailService } from "../roles/mail.service";
import { CreateShopkeeperDto } from "./dto/createShopkeeper.dto";
import { Otp } from "../otp/entities/otp.entity";
import { Types } from "mongoose";
import Razorpay from "razorpay";
import { CreateRazorpayLinkedAccountDto } from "./dto/razorpay.dto";

@Injectable()
export class ShopkeepersService {
  private logger = new Logger(ShopkeepersService.name);
  private razorPay: Razorpay;
  constructor(
    @InjectModel(Shopkeeper.name) private shopModel: Model<ShopkeeperDocument>,
    @InjectModel(Otp.name) private otpModel: Model<Otp>, // Use your existing Otp model
    private readonly jwtService: JwtService,
    private readonly mailService: MailService
  ) {
    const Razorpay = require("razorpay");
    this.razorPay = new Razorpay({
      key_id: process.env.RAZORPAY_PARTNER_KEY_ID,
      key_secret: process.env.RAZORPAY_PARTNER_SECRET,
    });
  }

  private normalizeEmail(email: string): string {
    return email.toLowerCase().trim();
  }

  async create(data: Partial<Shopkeeper>) {
    const created = new this.shopModel(data);
    return created.save();
  }

  async createRazorpayLinkedAccount(
    shopkeeperId: string,
    dto: CreateRazorpayLinkedAccountDto
  ) {
    try {
      this.logger.log(`Creating Razorpay linked account for: ${shopkeeperId}`);

      // Validate required fields
      if (!dto.businessName || !dto.panNumber || !dto.bankAccountNumber) {
        throw new BadRequestException("Missing required KYC fields");
      }

      // Call Razorpay Partner API
      const linkedAccount = await this.razorPay.accounts.create({
        email: dto.businessEmail,
        phone: dto.businessPhone,
        type: "route", // Enable Route for settlement splits
        legal_business_name: dto.businessName,
        business_type: dto.businessType,

        // Address
        legal_address: {
          street: dto.address,
          city: dto.city,
          state: dto.state,
          postal_code: dto.zipcode,
          country: dto.country === "IN" ? "IN" : "SG",
        },

        // KYC Details
        ...(dto.country === "IN" && {
          pan: dto.panNumber,
          gst: dto.gstNumber || null,
        }),
        ...(dto.country === "SG" && {
          uen: dto.uenNumber,
        }),

        // Bank account for payouts
        bank_account: {
          ifsc_code: dto.ifscCode,
          beneft_name: dto.accountHolderName,
          account_number: dto.bankAccountNumber,
          account_type: "savings",
        },

        // Internal notes
        notes: {
          shopkeeper_id: shopkeeperId,
          platform: "EventSH",
          created_at: new Date().toISOString(),
        },
      } as any);

      this.logger.log(`✅ Linked account created: ${linkedAccount.id}`);

      // Save to database
      const updated = await this.shopModel.findByIdAndUpdate(
        shopkeeperId,
        {
          razorpay: {
            accountId: linkedAccount.id,
            status: linkedAccount.status || "pending_kyc",
            kycStatus: (linkedAccount as any).kyc_status || "not_provided",
            businessName: dto.businessName,
            panNumber: dto.panNumber,
            gstNumber: dto.gstNumber,
            uenNumber: dto.uenNumber,
            bankAccountNumber: dto.bankAccountNumber,
            bankIfscCode: dto.ifscCode,
            bankName: dto.bankName,
            accountHolderName: dto.accountHolderName,
            businessEmail: dto.businessEmail,
            businessPhone: dto.businessPhone,
            createdAt: new Date(),
          },
        },
        { new: true }
      );

      return {
        success: true,
        accountId: linkedAccount.id,
        status: linkedAccount.status,
        message:
          "Account created. KYC review: 1-3 business days. Money will settle directly to your bank.",
      };
    } catch (error) {
      this.logger.error(`Failed to create linked account: ${error.message}`);
      throw new BadRequestException(`Razorpay setup failed: ${error.message}`);
    }
  }

  // ✅ NEW: Check Razorpay Account Status
  async checkRazorpayAccountStatus(accountId: string) {
    try {
      const account = await this.razorPay.accounts.fetch(accountId);

      return {
        accountId: account.id,
        status: account.status, // 'pending_kyc', 'active', 'rejected', 'suspended'
        kycStatus: (account as any).kyc_status,
        isActive: account.status === "active",
      };
    } catch (error) {
      this.logger.error(`Failed to check account status: ${error.message}`);
      throw new BadRequestException("Could not fetch account status");
    }
  }

  // ✅ NEW: Update Razorpay account status (called by cron/polling)
  async updateRazorpayAccountStatus(shopkeeperId: string, accountId: string) {
    try {
      const status = await this.checkRazorpayAccountStatus(accountId);

      if (status.isActive) {
        await this.shopModel.findByIdAndUpdate(shopkeeperId, {
          "razorpay.status": "active",
          "razorpay.verifiedAt": new Date(),
        });

        this.logger.log(`✅ Account activated: ${accountId}`);
        return { isActive: true };
      }

      return { isActive: false, status: status.status };
    } catch (error) {
      this.logger.error(`Account status update failed: ${error.message}`);
      throw error;
    }
  }

  async list() {
    try {
      const shopkeeper = await this.shopModel.find().exec();
      if (!shopkeeper) {
        throw new NotFoundException("Shopkeeper Not Found");
      }
      return { message: "Shopkeeper Found", data: shopkeeper };
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  async getByEmail(email: string) {
    try {
      const normalizedEmail = this.normalizeEmail(email);
      const shopkeeper = await this.shopModel.findOne({
        email: normalizedEmail,
        approved: true,
      });
      if (shopkeeper) return { message: "Shopkeeper found", data: shopkeeper };
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  async get(id: string) {
    try {
      const shopkeeper = await this.shopModel.findOne({ _id: id });
      if (!shopkeeper) {
        throw new NotFoundException("Shopkeeper not found");
      }

      if (shopkeeper.shopClosedToDate) {
        const today = new Date();
        const closedTo = new Date(shopkeeper.shopClosedToDate);

        // if today is after the closed-to date, clear both fields
        if (today > closedTo) {
          await this.shopModel.findByIdAndUpdate(
            id,
            {
              $unset: {
                shopClosedFromDate: "",
                shopClosedToDate: "",
              },
            },
            { new: true }
          );
          // optionally also update the in-memory object if you need it fresh:
          shopkeeper.shopClosedFromDate = undefined;
          shopkeeper.shopClosedToDate = undefined;
        }
      }

      return { message: "Shopkeeper Found", data: shopkeeper };
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  // Request OTP with your existing Otp schema
  async requestOTP(email: string) {
    try {
      const normalizedEmail = this.normalizeEmail(email); // ensure lowercase+trim
      console.log(`Requesting OTP for: ${normalizedEmail}`);

      const shopkeeper = await this.shopModel.findOne({
        businessEmail: normalizedEmail,
        approved: true,
      });

      console.log(shopkeeper, "Vansh Shakrna,sfd");

      if (!shopkeeper) {
        throw new NotFoundException("Shopkeeper not found or not approved");
      }

      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      const channel = "business_email";
      const role = "shopkeeper";
      const identifier = normalizedEmail;

      // Optional: Cooldown guard (e.g., 30s). Uncomment if wanted.
      // const existing = await this.otpModel.findOne({ channel, role, identifier });
      // if (existing?.lastSentAt && (Date.now() - new Date(existing.lastSentAt).getTime()) < 30_000) {
      //   throw new BadRequestException("Please wait before requesting a new OTP");
      // }

      // Upsert by channel/role/identifier
      await this.otpModel.findOneAndUpdate(
        { channel, role, identifier },
        {
          email: normalizedEmail, // keep legacy field if other code reads it
          otp,
          expiresAt,
          attempts: 0,
          verified: false,
          lastSentAt: new Date(),
          channel,
          identifier,
          role,
        },
        { upsert: true, new: true }
      );

      console.log(`OTP saved to database for ${normalizedEmail}: ${otp}`);

      const businessEmail = shopkeeper.businessEmail || shopkeeper.email;

      await this.mailService.sendOTPEmail({
        name: shopkeeper.name,
        email: businessEmail,
        otp,
        businessName: shopkeeper.shopName || shopkeeper.name,
      });

      return {
        message: "OTP sent successfully to your registered business email",
        data: {
          email: normalizedEmail,
          businessEmail,
          expiresIn: 10,
        },
      };
    } catch (error) {
      console.log("Error in requestOTP:", error);
      throw error;
    }
  }

  // Verify OTP with your existing Otp schema
  async verifyOTP(email: string, otp: string) {
    try {
      const normalizedEmail = this.normalizeEmail(email);
      console.log(`Verifying OTP for: ${normalizedEmail}`);

      const channel = "business_email";
      const role = "shopkeeper";
      const identifier = normalizedEmail;

      const otpDoc = await this.otpModel.findOne({
        channel,
        role,
        identifier,
        verified: false,
      });

      if (!otpDoc) {
        console.log(`No OTP document found for email: ${normalizedEmail}`);
        throw new BadRequestException(
          "OTP not found or expired. Please request a new one."
        );
      }

      if (new Date() > otpDoc.expiresAt) {
        console.log("OTP has expired");
        await this.otpModel.deleteOne({ _id: otpDoc._id });
        throw new BadRequestException(
          "OTP has expired. Please request a new one."
        );
      }

      if (otpDoc.attempts >= 3) {
        console.log("Too many attempts");
        await this.otpModel.deleteOne({ _id: otpDoc._id });
        throw new BadRequestException(
          "Too many invalid attempts. Please request a new OTP."
        );
      }

      if (otpDoc.otp !== otp) {
        console.log(`OTP mismatch. Expected: ${otpDoc.otp}, Received: ${otp}`);
        await this.otpModel.updateOne(
          { _id: otpDoc._id },
          { $inc: { attempts: 1 } }
        );
        throw new BadRequestException(
          `Invalid OTP. ${3 - otpDoc.attempts - 1} attempts remaining.`
        );
      }

      console.log("OTP verified successfully");

      const shopkeeper = await this.shopModel.findOne({
        businessEmail: normalizedEmail,
        approved: true,
      });

      if (!shopkeeper) {
        throw new NotFoundException("Shopkeeper not found or not approved");
      }

      const payload = {
        name: shopkeeper.name,
        email: shopkeeper.email,
        sub: shopkeeper._id,
        country: shopkeeper.country,
        roles: ["shopkeeper"],
      };

      const token = this.jwtService.sign(payload, {
        secret: process.env.JWT_ACCESS_SECRET,
        expiresIn: "24h",
      });

      await this.otpModel.deleteOne({ _id: otpDoc._id });
      console.log(`OTP deleted for ${normalizedEmail}`);

      return {
        message: "Login successful",
        data: {
          token,
          shopkeeper: {
            id: shopkeeper._id,
            name: shopkeeper.name,
            email: shopkeeper.email,
            businessName: shopkeeper.shopName,
          },
        },
      };
    } catch (error) {
      console.log("Error in verifyOTP:", error);
      throw error;
    }
  }

  // Resend OTP with your existing Otp schema
  async resendOTP(email: string) {
    try {
      const normalizedEmail = this.normalizeEmail(email);
      console.log(`Resending OTP for: ${normalizedEmail}`);

      const shopkeeper = await this.shopModel.findOne({
        businessEmail: normalizedEmail,
        approved: true,
      });

      if (!shopkeeper) {
        throw new NotFoundException("Shopkeeper not found or not approved");
      }

      const channel = "business_email";
      const role = "shopkeeper";
      const identifier = normalizedEmail;

      // Rate limit: last 60 seconds by lastSentAt (preferred over createdAt after upsert)
      const existing = await this.otpModel.findOne({
        channel,
        role,
        identifier,
      });
      if (
        existing?.lastSentAt &&
        Date.now() - new Date(existing.lastSentAt).getTime() < 60 * 1000
      ) {
        throw new BadRequestException(
          "Please wait 60 seconds before requesting a new OTP"
        );
      }

      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      await this.otpModel.findOneAndUpdate(
        { channel, role, identifier },
        {
          email: normalizedEmail, // legacy
          otp,
          expiresAt,
          attempts: 0,
          verified: false,
          lastSentAt: new Date(),
          channel,
          identifier,
          role,
        },
        { upsert: true, new: true }
      );

      console.log(`New OTP saved for ${normalizedEmail}: ${otp}`);

      const businessEmail = shopkeeper.businessEmail || shopkeeper.email;

      await this.mailService.sendOTPEmail({
        name: shopkeeper.name,
        email: businessEmail,
        otp,
        businessName: shopkeeper.shopName || shopkeeper.name,
      });

      return {
        message: "New OTP sent successfully",
        data: {
          email: businessEmail,
          expiresIn: 10,
        },
      };
    } catch (error) {
      console.log("Error in resendOTP:", error);
      throw error;
    }
  }

  // Rest of your existing methods remain the same...
  async login(dto: LoginDto) {
    try {
      const normalizedEmail = this.normalizeEmail(dto.email);
      const shopkeeper = await this.shopModel.findOne({
        email: normalizedEmail,
      });

      if (!shopkeeper) {
        throw new NotFoundException("Shopkeeper Not Found");
      }

      if (!shopkeeper.approved) {
        throw new NotFoundException(
          "Your request is still pending! Please wait for admin Approval..."
        );
      }

      // const isMatch = await bcrypt.compare(dto.password, shopkeeper.password);
      // if (!isMatch) {
      //   throw new UnauthorizedException("Invalid Credentials");
      // }

      const payload = {
        name: shopkeeper.name,
        email: shopkeeper.email,
        sub: shopkeeper._id,
        roles: ["shopkeeper"],
      };

      const token = this.jwtService.sign(payload, {
        secret: process.env.JWT_ACCESS_SECRET,
        expiresIn: "1h",
      });

      return { message: "login Successful", data: token };
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  async register(dto: CreateShopkeeperDto) {
    const normalizedEmail = this.normalizeEmail(dto.email);
    const existing = await this.shopModel.findOne({ email: normalizedEmail });
    if (existing) throw new ConflictException("Email already registered");
    const created = await new this.shopModel({
      ...dto,
      email: normalizedEmail,
      approved: false,
      rejected: false,
      status: "pending",
    }).save();

    await this.mailService.sendApprovalRequestToAdmin({
      name: dto.name,
      email: dto.email,
      role: "shopkeeper",
    });

    await this.mailService.sendConfirmationToUser({
      name: dto.name,
      email: dto.email,
      role: "shopkeeper",
    });

    const userObj = created.toObject();
    return userObj;
  }

  async getProfile(id: string) {
    const shopkeeper = await this.shopModel.findById(id).lean().exec();
    if (!shopkeeper) {
      throw new NotFoundException("Shopkeeper not found with this id");
    }

    // delete shopkeeper.password;
    return { message: "Shopkeeper Found", data: shopkeeper };
  }

  async updateProfile(
    id: string,
    body: {
      ownerName?: string;
      shopName?: string;
      email?: string;
      businessEmail?: string;
      whatsappNumber?: string;
      phone?: string;
      address?: string;
      description?: string;
      GSTNumber?: string;
      UENNumber?: string;
      hasDocVerification?: boolean;
      taxPercentage?: string | number; // Accept both string/number from FormData
      businessCategory?: string;
      paymentURL?: string;
      shopClosedFromDate?: Date; // Accept string from FormData
      shopClosedToDate?: Date; // Accept string from FormData
      country?: string; // IN/SG
    },
    paymentQrPublicUrl?: string | null
  ) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException("Invalid shopkeeper id");
    }

    const update: Record<string, any> = {};

    // ✅ EXISTING FIELDS
    if (body.ownerName !== undefined) update.name = body.ownerName;
    if (body.shopName !== undefined) update.shopName = body.shopName;
    if (body.email !== undefined)
      update.email = this.normalizeEmail(body.email);
    if (body.businessEmail !== undefined)
      update.businessEmail = this.normalizeEmail(body.businessEmail);
    if (body.whatsappNumber !== undefined)
      update.whatsappNumber = body.whatsappNumber;
    if (body.phone !== undefined) update.phone = body.phone;
    if (body.address !== undefined) update.address = body.address;
    if (body.description !== undefined) update.description = body.description;

    // ✅ NEW FIELDS
    if (body.GSTNumber !== undefined) update.GSTNumber = body.GSTNumber;
    if (body.UENNumber !== undefined) update.UENNumber = body.UENNumber;
    if (body.hasDocVerification !== undefined) {
      // ✅ Type-safe boolean conversion
      update.hasDocVerification =
        typeof body.hasDocVerification === "boolean"
          ? body.hasDocVerification
          : body.hasDocVerification === "true";
    }
    if (body.businessCategory !== undefined)
      update.businessCategory = body.businessCategory;

    // ✅ TAX PERCENTAGE (handle string/number)
    if (body.taxPercentage !== undefined) {
      const taxNum =
        typeof body.taxPercentage === "string"
          ? parseFloat(body.taxPercentage)
          : body.taxPercentage;
      update.taxPercentage = isNaN(taxNum) ? 0 : taxNum;
    }

    // ✅ DATES (handle string/Date from FormData)
    if (body.shopClosedFromDate !== undefined) {
      update.shopClosedFromDate =
        typeof body.shopClosedFromDate === "string"
          ? new Date(body.shopClosedFromDate)
          : body.shopClosedFromDate;
    }
    if (body.shopClosedToDate !== undefined) {
      update.shopClosedToDate =
        typeof body.shopClosedToDate === "string"
          ? new Date(body.shopClosedToDate)
          : body.shopClosedToDate;
    }

    // ✅ NEW: Country field
    if (body.country !== undefined) update.country = body.country;

    // ✅ Persist uploaded QR public URL (overrides paymentURL if provided)
    if (paymentQrPublicUrl) {
      update.paymentURL = paymentQrPublicUrl;
    } else if (body.paymentURL !== undefined) {
      update.paymentURL = body.paymentURL;
    }

    console.log("Update payload:", update);

    const updated = await this.shopModel
      .findByIdAndUpdate(id, update, { new: true, runValidators: true })
      .lean()
      .exec();

    if (!updated) {
      throw new NotFoundException("Shopkeeper not found");
    }

    // ✅ Remove sensitive data
    delete (updated as any).password;
    delete (updated as any).__v;

    return {
      message: "Profile updated successfully",
      data: updated,
    };
  }

  async findByWhatsAppNumber(whatsAppNumber: string) {
    try {
      console.log(whatsAppNumber);
      const shopkeeper = await this.shopModel.findOne({
        whatsappNumber: whatsAppNumber,
      });
      console.log(shopkeeper);
      if (!shopkeeper) {
        throw new NotFoundException("Shopkeeper Not Found");
      }

      const payload = {
        name: shopkeeper.name,
        email: shopkeeper.email,
        sub: shopkeeper._id,
        country: shopkeeper.country,
        roles: ["shopkeeper"],
      };

      const token = this.jwtService.sign(payload, {
        secret: process.env.JWT_ACCESS_SECRET,
        expiresIn: "24h",
      });

      return { message: "Token found", token: token };
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  async whatsAppNumberExists(whatsAppNumber: string) {
    try {
      const shopkeeper = await this.shopModel.findOne({
        whatsappNumber: whatsAppNumber,
      });
      console.log(shopkeeper);
      if (!shopkeeper) {
        throw new NotFoundException("Shopkeeper Not Found");
      }

      return { message: "shopkeeper found", data: shopkeeper };
    } catch (error) {
      throw error;
    }
  }

  async findByRazorpayStatus(status: string) {
    return this.shopModel.find({ "razorpay.status": status });
  }
}
