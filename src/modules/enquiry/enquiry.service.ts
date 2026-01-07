import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { CreateEnquiryDto } from "./dto/create-enquiry.dto";
import { UpdateEnquiryDto } from "./dto/update-enquiry.dto";
import { Enquiry, EnquiryDocument } from "./entities/enquiry.entity";
import { MailerService } from "@nestjs-modules/mailer";
import { MailService } from "../roles/mail.service";

@Injectable()
export class EnquiryService {
  constructor(
    @InjectModel(Enquiry.name) private enquiryModel: Model<EnquiryDocument>,
    private mailerService: MailerService,
    private mailService: MailService
  ) {}

  async create(createEnquiryDto: CreateEnquiryDto) {
    try {
      const enquiry = new this.enquiryModel(createEnquiryDto);
      const savedEnquiry = await enquiry.save();

      // Send confirmation email to user
      await this.mailService.sendEnquiryConfirmationToUser({
        firstName: createEnquiryDto.firstName,
        emailId: createEnquiryDto.emailId,
        enquiryFor: createEnquiryDto.enquiryFor,
        organizationName: createEnquiryDto.organizationName,
      });

      // Send notification to admin
      // await this.sendAdminNotification(createEnquiryDto);

      return {
        success: true,
        message: "Enquiry submitted successfully. We will contact you soon.",
        data: savedEnquiry,
      };
    } catch (error) {
      throw new BadRequestException(
        "Failed to submit enquiry: " + error.message
      );
    }
  }

  async findAll() {
    try {
      const enquiries = await this.enquiryModel
        .find()
        .sort({ createdAt: -1 })
        .exec();
      return enquiries;
    } catch (error) {
      throw new BadRequestException(
        "Failed to fetch enquiries: " + error.message
      );
    }
  }

  async findOne(id: string) {
    try {
      const enquiry = await this.enquiryModel.findById(id).exec();
      if (!enquiry) {
        throw new NotFoundException(`Enquiry with ID ${id} not found`);
      }
      return enquiry;
    } catch (error) {
      throw new NotFoundException("Enquiry not found");
    }
  }

  async update(id: string, updateEnquiryDto: UpdateEnquiryDto) {
    try {
      const enquiry = await this.enquiryModel
        .findByIdAndUpdate(id, updateEnquiryDto, { new: true })
        .exec();

      if (!enquiry) {
        throw new NotFoundException(`Enquiry with ID ${id} not found`);
      }

      return {
        success: true,
        message: "Enquiry updated successfully",
        data: enquiry,
      };
    } catch (error) {
      throw new BadRequestException(
        "Failed to update enquiry: " + error.message
      );
    }
  }

  async remove(id: string) {
    try {
      const enquiry = await this.enquiryModel.findByIdAndDelete(id).exec();

      if (!enquiry) {
        throw new NotFoundException(`Enquiry with ID ${id} not found`);
      }

      return {
        success: true,
        message: "Enquiry deleted successfully",
        data: enquiry,
      };
    } catch (error) {
      throw new BadRequestException(
        "Failed to delete enquiry: " + error.message
      );
    }
  }

  async findByEmail(emailId: string) {
    try {
      const enquiries = await this.enquiryModel
        .find({ emailId })
        .sort({ createdAt: -1 })
        .exec();
      return enquiries;
    } catch (error) {
      throw new BadRequestException(
        "Failed to fetch enquiries: " + error.message
      );
    }
  }

  async findByEnquiryType(enquiryFor: string) {
    try {
      const enquiries = await this.enquiryModel
        .find({ enquiryFor })
        .sort({ createdAt: -1 })
        .exec();
      return enquiries;
    } catch (error) {
      throw new BadRequestException(
        "Failed to fetch enquiries: " + error.message
      );
    }
  }

  async getEnquiryStats() {
    try {
      const stats = await this.enquiryModel.aggregate([
        {
          $group: {
            _id: "$enquiryFor",
            count: { $sum: 1 },
          },
        },
      ]);

      const statusStats = await this.enquiryModel.aggregate([
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
          },
        },
      ]);

      return {
        enquiryTypeStats: stats,
        statusStats: statusStats,
        totalEnquiries: await this.enquiryModel.countDocuments(),
      };
    } catch (error) {
      throw new BadRequestException("Failed to fetch stats: " + error.message);
    }
  }

  private async sendConfirmationEmail(enquiry: CreateEnquiryDto) {
    try {
      await this.mailerService.sendMail({
        to: enquiry.emailId,
        subject: "Enquiry Received - EventSH",
        template: "enquiry-confirmation",
        context: {
          firstName: enquiry.firstName,
          organizationName: enquiry.organizationName,
          enquiryType: this.getEnquiryTypeLabel(enquiry.enquiryFor),
        },
      });
    } catch (error) {
      console.error("Error sending confirmation email:", error);
    }
  }

  private async sendAdminNotification(enquiry: CreateEnquiryDto) {
    try {
      await this.mailerService.sendMail({
        to: process.env.ADMIN_EMAIL || "hello@eventsh.com",
        subject: `New Enquiry from ${enquiry.firstName} ${enquiry.lastName}`,
        template: "enquiry-admin-notification",
        context: {
          firstName: enquiry.firstName,
          lastName: enquiry.lastName,
          organizationName: enquiry.organizationName,
          enquiryFor: this.getEnquiryTypeLabel(enquiry.enquiryFor),
          contactNumber: enquiry.contactNumber,
          emailId: enquiry.emailId,
          message: enquiry.message,
          submittedAt: new Date().toLocaleString("en-IN", {
            timeZone: "Asia/Kolkata",
          }),
        },
      });
    } catch (error) {
      console.error("Error sending admin notification:", error);
    }
  }

  private getEnquiryTypeLabel(type: string): string {
    const labels = {
      events: "Events Management",
      eshop: "E-Shop Platform",
      both: "Both Services",
    };
    return labels[type] || type;
  }
}
