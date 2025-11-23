import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
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

@Injectable()
export class ShopkeepersService {
  constructor(
    @InjectModel(Shopkeeper.name) private shopModel: Model<ShopkeeperDocument>,
    @InjectModel(Otp.name) private otpModel: Model<Otp>, // Use your existing Otp model
    private readonly jwtService: JwtService,
    private readonly mailService: MailService
  ) {}

  private normalizeEmail(email: string): string {
    return email.toLowerCase().trim();
  }

  async create(data: Partial<Shopkeeper>) {
    const created = new this.shopModel(data);
    return created.save();
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

      const isMatch = await bcrypt.compare(dto.password, shopkeeper.password);
      if (!isMatch) {
        throw new UnauthorizedException("Invalid Credentials");
      }

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

    const hashed = await bcrypt.hash(dto.password, 10);
    const created = await new this.shopModel({
      ...dto,
      email: normalizedEmail,
      password: hashed,
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
    delete userObj.password;
    return userObj;
  }

  async getProfile(id: string) {
    const shopkeeper = await this.shopModel.findById(id).lean().exec();
    if (!shopkeeper) {
      throw new NotFoundException("Shopkeeper not found with this id");
    }

    delete shopkeeper.password;
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
      taxPercentage?: string;
      businessCategory?: string;
      paymentURL?: string; // keep if you still send a string
      shopClosedFromDate?: Date;
      shopClosedToDate?: Date;
    },
    paymentQrPublicUrl?: string | null
  ) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException("Invalid shopkeeper id");
    }

    const update: Record<string, any> = {};

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
    if (body.taxPercentage !== undefined)
      update.taxPercentage = body.taxPercentage;
    if (body.businessCategory !== undefined)
      update.businessCategory = body.businessCategory;
    if (body.paymentURL !== undefined) update.paymentURL = body.paymentURL;
    if (body.shopClosedFromDate !== undefined)
      update.shopClosedFromDate = body.shopClosedFromDate;
    if (body.shopClosedToDate !== undefined)
      update.shopClosedToDate = body.shopClosedToDate;

    // Persist uploaded QR public URL to document
    if (paymentQrPublicUrl) {
      update.paymentURL = paymentQrPublicUrl;
    }

    console.log(update, "update");

    const updated = await this.shopModel
      .findByIdAndUpdate(id, update, { new: true, runValidators: true })
      .lean()
      .exec();

    if (!updated) {
      throw new NotFoundException("Shopkeeper not found");
    }

    delete (updated as any).password;
    return { message: "Profile updated", data: updated };
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

  async registerForStall() {}
}
