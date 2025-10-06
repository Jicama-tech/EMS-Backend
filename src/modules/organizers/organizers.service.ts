import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { Organizer, OrganizerDocument } from "./schemas/organizer.schema";
import { LocalDto } from "../auth/dto/local.dto";
import * as bcrypt from "bcrypt";
import { JwtService } from "@nestjs/jwt";
import { LoginDto } from "../admin/dto/login.dto";
import { EventDocument } from "../events/schemas/event.schema";
import { User } from "../users/schemas/user.schema";
import { MailService } from "../roles/mail.service";
import { CreateOrganizerDto } from "./dto/createOrganizer.dto";
import { Otp } from "../otp/entities/otp.entity";
import { UpdateOrganizerDto } from "./dto/updateOrganizer.dto";
import * as path from "path";
import * as fs from "fs";

@Injectable()
export class OrganizersService {
  constructor(
    @InjectModel(Organizer.name)
    private organizerModel: Model<OrganizerDocument>,
    @InjectModel(Otp.name) private otpModel: Model<Otp>, // Inject the OTP model
    @InjectModel(Event.name)
    private eventModel: Model<EventDocument>,
    @InjectModel(User.name)
    private userModel: Model<User>,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService
  ) {}

  private normalizeEmail(email: string): string {
    return email.toLowerCase().trim();
  }

  async create(data: Partial<Organizer>) {
    const created = new this.organizerModel(data);
    return created.save();
  }

  async findByEmail(email: string) {
    try {
      const organizer = await this.organizerModel.findOne({
        email: email,
        approved: true,
      });

      if (organizer) return { message: "Organizer found", data: organizer };
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  async list(organizerId: string) {
    try {
      const organizer = new Types.ObjectId(organizerId);
      const events = await this.eventModel.find({
        organizer: organizer,
      });
      if (!events) {
        throw new NotFoundException("No events found");
      }
      return { message: "Events found", data: events };
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  async getDashboardDataForOrganizer(organizerId: string): Promise<any> {
    const now = new Date();

    // Calculate start of today (midnight)
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      0,
      0,
      0,
      0
    );

    // Calculate end of today (just before midnight next day)
    const endOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23,
      59,
      59,
      999
    );

    // Convert organizerId to ObjectId if needed (depends on your schema and ORM)
    // const organizer = new Types.ObjectId(organizerId);

    const currentEvents = await this.eventModel
      .find({
        organizer: organizerId,
        // Events that start before end of today
        startDate: { $lte: endOfToday },
        // and endDate is either null or after start of today
        $or: [{ endDate: { $gte: startOfToday } }, { endDate: null }],
      })
      .lean();

    const upcomingEvents = await this.eventModel
      .find({
        organizer: organizerId,
        startDate: { $gt: endOfToday }, // strictly after today
      })
      .lean();

    const pastEvents = await this.eventModel
      .find({
        organizer: organizerId,
        endDate: { $lt: startOfToday }, // strictly before today
      })
      .lean();

    const totalEvents = await this.eventModel.countDocuments({
      organizer: organizerId,
    });

    const totalAttendees = await this.eventModel.aggregate([
      { $match: { organizer: organizerId } },
      { $group: { _id: null, total: { $sum: "$attendees" } } },
    ]);

    return {
      stats: [
        { title: "Total Events", value: totalEvents.toString() },
        {
          title: "Total Attendees",
          value: totalAttendees[0]?.total?.toLocaleString() || "0",
        },
      ],
      currentEvents,
      upcomingEvents,
      pastEvents,
    };
  }

  async registerOrganizer(dto: CreateOrganizerDto) {
    const existing = await this.organizerModel.findOne({ email: dto.email });
    if (existing)
      throw new ConflictException("Organizer with this email already exists");

    const organizer = await new this.organizerModel({
      ...dto,
      status: "pending",
      approved: false,
      rejected: false,
    }).save();

    await this.mailService.sendApprovalRequestToAdmin({
      name: dto.name,
      email: dto.email,
      role: "organizer",
    });
    await this.mailService.sendConfirmationToUser({
      name: dto.name,
      email: dto.email,
      role: "organizer",
    });

    return organizer;
  }

  async requestOTP(email: string) {
    try {
      const normalizedEmail = this.normalizeEmail(email);
      console.log(`Requesting OTP for: ${normalizedEmail}`);

      const organizer = await this.organizerModel.findOne({
        businessEmail: normalizedEmail,
        approved: true,
      });

      if (!organizer) {
        throw new NotFoundException("Organizer not found or not approved");
      }

      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      const channel = "business_email";
      const role = "organizer";
      const identifier = normalizedEmail;

      await this.otpModel.findOneAndUpdate(
        { channel, role, identifier },
        {
          email: normalizedEmail,
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

      const businessEmail = organizer.businessEmail || organizer.email;

      await this.mailService.sendOTPEmail({
        name: organizer.name,
        email: businessEmail,
        otp,
        businessName: organizer.organizationName || organizer.name,
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

  async verifyOTP(email: string, otp: string) {
    try {
      const normalizedEmail = this.normalizeEmail(email);
      console.log(`Verifying OTP for: ${normalizedEmail}`);

      const channel = "business_email";
      const role = "organizer";
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

      const organizer = await this.organizerModel.findOne({
        businessEmail: normalizedEmail,
        approved: true,
      });

      if (!organizer) {
        throw new NotFoundException("Organizer not found or not approved");
      }

      const payload = {
        name: organizer.name,
        email: organizer.email,
        sub: organizer._id,
        roles: ["organizer"],
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
          organizer: {
            id: organizer._id,
            name: organizer.name,
            email: organizer.email,
            businessName: organizer.organizationName,
          },
        },
      };
    } catch (error) {
      console.log("Error in verifyOTP:", error);
      throw error;
    }
  }

  async resendOTP(email: string) {
    try {
      const normalizedEmail = this.normalizeEmail(email);
      console.log(`Resending OTP for: ${normalizedEmail}`);

      const organizer = await this.organizerModel.findOne({
        businessEmail: normalizedEmail,
        approved: true,
      });

      if (!organizer) {
        throw new NotFoundException("Organizer not found or not approved");
      }

      const channel = "business_email";
      const role = "organizer";
      const identifier = normalizedEmail;

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
          email: normalizedEmail,
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

      const businessEmail = organizer.businessEmail || organizer.email;

      await this.mailService.sendOTPEmail({
        name: organizer.name,
        email: businessEmail,
        otp,
        businessName: organizer.organizationName || organizer.name,
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

  async findByWhatsAppNumber(whatsAppNumber: string) {
    try {
      console.log(whatsAppNumber);
      const organizer = await this.organizerModel.findOne({
        whatsAppNumber: whatsAppNumber,
      });
      console.log(organizer);
      if (!organizer) {
        throw new NotFoundException("Organizer Not Found");
      }

      const payload = {
        name: organizer.name,
        email: organizer.email,
        sub: organizer._id,
        roles: ["organizer"],
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

  async approve(id: string) {
    return this.organizerModel
      .findByIdAndUpdate(id, { approved: true }, { new: true })
      .exec();
  }

  async getprofile(id: string) {
    try {
      const organizer = await this.organizerModel.findOne({ _id: id });
      console.log(organizer);
      if (!organizer) {
        throw new NotFoundException("Organizer Not Found");
      }
      return { message: "Organizer Found", data: organizer };
    } catch (error) {
      throw error;
    }
  }

  async getOrganizer(id: string) {
    try {
      console.log("Calleeedsfjsnafjsdfv");
      const organizer = await this.organizerModel.find({ _id: id });
      console.log(organizer);
      if (!organizer) {
        throw new NotFoundException("Organizer Not Found");
      }
      return { message: "Organizer Found", data: organizer };
    } catch (error) {
      throw error;
    }
  }

  async getProfile(id: string) {
    try {
      const _id = new Types.ObjectId(id);
      const organizer = await this.organizerModel.findOne({ _id });
      if (!organizer) {
        throw new NotFoundException("Not Found");
      }

      return { message: "Organizer Found", data: organizer };
    } catch (error) {
      throw error;
    }
  }

  async updateProfile(
    id: string,
    body: {
      name?: string;
      email?: string;
      organizationName?: string;
      businessEmail?: string;
      whatsAppNumber?: string;
      address?: string;
      slug?: string;
      paymentURL?: string;
      phoneNumber?: string;
      bio?: string;
    },
    paymentQrPublicUrl?: string | null
  ) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException("Invalid organizer id");
    }

    const update: Record<string, any> = {};

    if (body.name !== undefined) update.name = body.name;
    if (body.email !== undefined) update.email = body.email.toLowerCase();
    if (body.organizationName !== undefined)
      update.organizationName = body.organizationName;
    if (body.phoneNumber !== undefined) update.phoneNumber = body.phoneNumber;
    if (body.businessEmail !== undefined)
      update.businessEmail = body.businessEmail.toLowerCase();
    if (body.whatsAppNumber !== undefined)
      update.whatsAppNumber = body.whatsAppNumber;
    if (body.address !== undefined) update.address = body.address;
    if (body.slug !== undefined) update.slug = body.slug;
    if (body.paymentURL !== undefined) update.paymentURL = body.paymentURL;
    if (body.phoneNumber !== undefined) update.phoneNumber = body.phoneNumber;
    if (body.bio !== undefined) update.bio = body.bio;

    if (paymentQrPublicUrl) {
      update.paymentURL = paymentQrPublicUrl;
    }

    const updated = await this.organizerModel
      .findByIdAndUpdate(id, update, {
        new: true,
        runValidators: true,
      })
      .lean()
      .exec();

    console.log(updated, "Vansh Sharma");

    if (!updated) {
      throw new NotFoundException("Organizer not found");
    }

    delete (updated as any).password; // if password exists

    return { message: "Profile updated", data: updated };
  }

  async getOrganizerBySlug(slug: string) {
    try {
      const organizer = await this.organizerModel.findOne({ slug: slug });
      if (!organizer) {
        throw new NotFoundException("Organizer Not Found");
      }

      return { message: "Organizer Found", data: organizer };
    } catch (error) {
      console.log(error);
      throw error;
    }
  }
}
