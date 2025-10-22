import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  BadRequestException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { CreateTicketDto } from "./dto/create-ticket.dto";
import { UpdateTicketDto } from "./dto/update-ticket.dto";
import { Ticket, TicketDocument, TicketStatus } from "./entities/ticket.entity";
import { Event } from "../events/schemas/event.schema";
import { Organizer } from "../organizers/schemas/organizer.schema";
import * as QRCode from "qrcode";
import * as fs from "fs";
import * as path from "path";
import { createTransport } from "nodemailer";
import { MailService } from "../roles/mail.service";

@Injectable()
export class TicketsService {
  constructor(
    @InjectModel(Ticket.name) private ticketModel: Model<TicketDocument>,
    @InjectModel(Event.name) private eventModel: Model<Event>,
    @InjectModel(Organizer.name) private organizerModel: Model<Organizer>,
    private mailService: MailService
    // private whatsAppService: WhatsAppService
  ) {
    // Ensure QR directory exists
    const qrDir = path.join(process.cwd(), "uploads", "generatedQRs");
    if (!fs.existsSync(qrDir)) {
      fs.mkdirSync(qrDir, { recursive: true });
    }
  }

  async create(createTicketDto: CreateTicketDto): Promise<Ticket> {
    try {
      const customerName = `${createTicketDto.customerDetails.firstName} ${createTicketDto.customerDetails.lastName}`;
      const ticketDetails = createTicketDto.tickets.map((t) => ({
        ticketType: t.type,
        quantity: t.quantity,
        price: t.price,
      }));
      const totalQuantity = createTicketDto.tickets.reduce(
        (acc, t) => acc + t.quantity,
        0
      );

      // Generate secure QR payload
      const qrPayload = {
        warning:
          "❌ Normal scanners not allowed. Please use the Eventsh app to scan this ticket.",
        type: "eventsh-ticket",
        ticketId: createTicketDto.ticketId,
        eventId: createTicketDto.eventId,
        issuedAt: new Date().toISOString(),
      };

      // Generate QR code base64 string (includes data:image/png;base64,)
      const qrCodeBase64 = await QRCode.toDataURL(JSON.stringify(qrPayload), {
        width: 200, // slightly smaller helps with email compatibility and size
        margin: 2,
      });
      // Save QR to disk (optional if needed)
      await this.saveQRToDisk(qrCodeBase64, createTicketDto.ticketId);

      // Create the ticket document
      const ticket = new this.ticketModel({
        ticketId: createTicketDto.ticketId,
        eventId: new Types.ObjectId(createTicketDto.eventId),
        organizerId: new Types.ObjectId(createTicketDto.organizerId),
        eventTitle: createTicketDto.eventInfo.title,
        eventDate: new Date(createTicketDto.eventInfo.date),
        eventTime: createTicketDto.eventInfo.time,
        eventVenue: createTicketDto.eventInfo.venue,
        customerName,
        customerEmail: createTicketDto.customerDetails.email,
        customerWhatsapp: createTicketDto.customerDetails.whatsapp,
        customerEmergencyContact:
          createTicketDto.customerDetails.emergencyContact,
        ticketDetails,
        totalAmount: createTicketDto.total,
        paymentConfirmed: createTicketDto.paymentConfirmed,
        status: createTicketDto.paymentConfirmed
          ? TicketStatus.CONFIRMED
          : TicketStatus.PENDING,
        purchaseDate: new Date(createTicketDto.purchaseDate),
        discount: createTicketDto.discount,
        couponCode: createTicketDto.couponCode,
        notes: createTicketDto.notes,
        qrCode: qrCodeBase64,
        isUsed: false,
      });

      console.log(qrPayload, "qrPayload");
      console.log(ticket, "ticket");

      const savedTicket = await ticket.save();
      await this.updateEventTicketCount(createTicketDto.eventId, totalQuantity);

      if (savedTicket.customerEmail) {
        const eventDate = new Date(savedTicket.eventDate).toLocaleDateString();

        const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
          <div style="background: linear-gradient(135deg, #3b82f6, #6366f1); color: white; padding: 30px; text-align: center;">
            <h1 style="margin: 0; font-size: 24px;">EVENTSH TICKET</h1>
            <p style="margin: 8px 0 0 0; opacity: 0.9;">${savedTicket.eventTitle}</p>
          </div>
          <div style="padding: 25px;">
            <h2 style="color: #1e293b; font-size: 18px; margin-bottom: 20px;">Ticket Details</h2>
            <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
              <p><strong>🎫 Ticket ID:</strong> ${savedTicket.ticketId}</p>
              <p><strong>👤 Attendee:</strong> ${savedTicket.customerName}</p>
              <p><strong>📅 Date:</strong> ${eventDate}</p>
              <p><strong>🕒 Time:</strong> ${savedTicket.eventTime || "N/A"}</p>
              <p><strong>📍 Venue:</strong> ${savedTicket.eventVenue || "N/A"}</p>
              <p><strong>💰 Total Amount:</strong> $${savedTicket.totalAmount?.toFixed(2) || "0.00"}</p>
            </div>
            <div style="text-align: center; margin: 25px 0;">
              <p style="margin-bottom: 15px; font-weight: 600; color: #1e293b;">Scan at Event Entrance</p>
              <img src="cid:qrcodeeventsh" alt="Ticket QR Code" style="width: 200px; height: 200px; border: 2px solid #e2e8f0; border-radius: 8px;" />
            </div>
            <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 15px; margin-top: 20px;">
              <p style="margin: 0; color: #dc2626; font-size: 14px;">
                ⚠️ <strong>Important:</strong> This QR code can ONLY be scanned using the official Eventsh app.<br>
                Normal camera scanners will not work.
              </p>
            </div>
          </div>
          <div style="background: #f1f5f9; padding: 15px; text-align: center; font-size: 12px; color: #64748b;">
            <p style="margin: 0;">© ${new Date().getFullYear()} Eventsh. All rights reserved.</p>
          </div>
        </div>
      `;

        // Send as cid attachment
        await this.mailService.sendEmail({
          to: savedTicket.customerEmail,
          subject: `🎟️ Your Eventsh Ticket - ${savedTicket.eventTitle}`,
          html,
          attachments: [
            {
              filename: "ticket-qrcode.png",
              content: qrCodeBase64.split(",")[1],
              encoding: "base64",
              cid: "qrcodeeventsh",
            },
          ],
        });
      }

      return savedTicket;
    } catch (error) {
      throw new InternalServerErrorException(
        `Failed to create ticket: ${error.message}`
      );
    }
  }

  private async saveQRToDisk(
    base64Data: string,
    ticketId: string
  ): Promise<string> {
    const qrDir = path.join(process.cwd(), "uploads", "generatedQRs");
    const fileName = `qr_${ticketId}.png`;
    const filePath = path.join(qrDir, fileName);
    const buffer = Buffer.from(base64Data.split(",")[1], "base64");
    await fs.promises.writeFile(filePath, buffer);
    return filePath;
  }

  private async sendTicketEmailWithEmbeddedQR(
    ticket: Ticket,
    qrBase64: string
  ): Promise<void> {
    try {
      const transporter = createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      const eventDate = new Date(ticket.eventDate).toLocaleDateString();
      const mailOptions = {
        from: process.env.SMTP_USER,
        to: ticket.customerEmail,
        subject: `🎟️ Your Eventsh Ticket - ${ticket.eventTitle}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
            <div style="background: linear-gradient(135deg, #3b82f6, #6366f1); color: white; padding: 30px; text-align: center;">
              <h1 style="margin: 0; font-size: 24px;">EVENTSH TICKET</h1>
              <p style="margin: 8px 0 0 0; opacity: 0.9;">${ticket.eventTitle}</p>
            </div>
            
            <div style="padding: 25px;">
              <h2 style="color: #1e293b; font-size: 18px; margin-bottom: 20px;">Ticket Details</h2>
              
              <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                <p><strong>🎫 Ticket ID:</strong> ${ticket.ticketId}</p>
                <p><strong>👤 Attendee:</strong> ${ticket.customerName}</p>
                <p><strong>📅 Date:</strong> ${eventDate}</p>
                <p><strong>🕒 Time:</strong> ${ticket.eventTime || "N/A"}</p>
                <p><strong>📍 Venue:</strong> ${ticket.eventVenue || "N/A"}</p>
                <p><strong>💰 Total Amount:</strong> $${ticket.totalAmount?.toFixed(2) || "0.00"}</p>
              </div>

              <div style="text-align: center; margin: 25px 0;">
                <p style="margin-bottom: 15px; font-weight: 600; color: #1e293b;">Scan at Event Entrance</p>
                <img src="${qrBase64}" alt="Ticket QR Code" style="width: 200px; height: 200px; border: 2px solid #e2e8f0; border-radius: 8px;" />
              </div>

              <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 15px; margin-top: 20px;">
                <p style="margin: 0; color: #dc2626; font-size: 14px;">
                  ⚠️ <strong>Important:</strong> This QR code can ONLY be scanned using the official Eventsh app. 
                  Normal camera scanners will not work.
                </p>
              </div>
            </div>

            <div style="background: #f1f5f9; padding: 15px; text-align: center; font-size: 12px; color: #64748b;">
              <p style="margin: 0;">© ${new Date().getFullYear()} Eventsh. All rights reserved.</p>
            </div>
          </div>
        `,
      };

      await transporter.sendMail(mailOptions);
      console.log(`Ticket email sent to: ${ticket.customerEmail}`);
    } catch (error) {
      console.error("Email sending failed:", error);
    }
  }

  private async updateEventTicketCount(eventId: string, quantity: number) {
    const event = await this.eventModel.findOne({ _id: eventId });
    if (!event) throw new NotFoundException("Event not found");

    if (event.totalTickets < quantity)
      throw new BadRequestException("Not enough tickets available");

    event.totalTickets -= quantity;
    await event.save();
  }

  // Removed generateTicketPDF method (not needed)

  async findAll(): Promise<Ticket[]> {
    return this.ticketModel.find().populate("eventId organizerId").exec();
  }

  async findOne(id: string): Promise<Ticket> {
    if (!Types.ObjectId.isValid(id))
      throw new BadRequestException("Invalid ticket ID");

    const ticket = await this.ticketModel
      .findById(id)
      .populate("eventId organizerId")
      .exec();

    if (!ticket) throw new NotFoundException("Ticket not found");

    return ticket;
  }

  async findByTicketId(ticketId: string): Promise<Ticket> {
    const ticket = await this.ticketModel
      .findOne({ ticketId: ticketId })
      .populate("eventId organizerId")
      .exec();

    if (!ticket) throw new NotFoundException("Ticket not found");

    return ticket;
  }

  async getCustomerTickets(customerEmail: string): Promise<Ticket[]> {
    return this.ticketModel
      .find({ customerEmail: customerEmail.toLowerCase() })
      .populate("eventId organizerId")
      .sort({ purchaseDate: -1 })
      .exec();
  }

  async getOrganizerTickets(organizerId: string): Promise<Ticket[]> {
    return this.ticketModel
      .find({ organizerId: new Types.ObjectId(organizerId) })
      .populate("eventId")
      .sort({ purchaseDate: -1 })
      .exec();
  }

  async getEventTickets(eventId: string): Promise<{
    tickets: Ticket[];
    summary: {
      totalTicketsSold: number;
      totalRevenue: number;
      ticketTypeBreakdown: any[];
      statusBreakdown: any[];
    };
  }> {
    if (!Types.ObjectId.isValid(eventId))
      throw new BadRequestException("Invalid event ID");

    const tickets = await this.ticketModel
      .find({ eventId: new Types.ObjectId(eventId) })
      .sort({ purchaseDate: -1 })
      .exec();

    const totalTicketsSold = tickets.reduce((sum, t) => sum + t.totalAmount, 0);
    const totalRevenue = tickets.reduce((sum, t) => sum + t.totalAmount, 0);

    const ticketTypeMap = new Map();
    tickets.forEach((ticket) => {
      ticket.ticketDetails.forEach((detail) => {
        const existing = ticketTypeMap.get(detail.ticketType) || {
          quantity: 0,
          revenue: 0,
        };
        existing.quantity += detail.quantity;
        existing.revenue += detail.price * detail.quantity;
        ticketTypeMap.set(detail.ticketType, existing);
      });
    });
    const ticketTypeBreakdown = Array.from(ticketTypeMap.entries()).map(
      ([type, data]) => ({
        ticketType: type,
        ...data,
      })
    );

    const statusMap = new Map();
    tickets.forEach((ticket) => {
      const count = statusMap.get(ticket.status) || 0;
      statusMap.set(ticket.status, count + 1);
    });
    const statusBreakdown = Array.from(statusMap.entries()).map(
      ([status, count]) => ({
        status,
        count,
      })
    );

    return {
      tickets,
      summary: {
        totalTicketsSold,
        totalRevenue,
        ticketTypeBreakdown,
        statusBreakdown,
      },
    };
  }

  async update(id: string, updateTicketDto: UpdateTicketDto): Promise<Ticket> {
    if (!Types.ObjectId.isValid(id))
      throw new BadRequestException("Invalid ticket ID");

    const updatedTicket = await this.ticketModel
      .findByIdAndUpdate(id, updateTicketDto, { new: true })
      .populate("eventId organizerId")
      .exec();

    if (!updatedTicket) throw new NotFoundException("Ticket not found");

    return updatedTicket;
  }

  async markTicketAsUsed(ticketId: string): Promise<Ticket> {
    const ticket = await this.ticketModel.findOne({ ticketId }).exec();

    if (!ticket) throw new NotFoundException("Ticket not found");

    if (ticket.isUsed) throw new BadRequestException("Ticket already used");
    if (ticket.status !== TicketStatus.CONFIRMED)
      throw new BadRequestException("Ticket is not confirmed");

    ticket.isUsed = true;
    ticket.usedAt = new Date();
    ticket.status = TicketStatus.USED;

    return ticket.save();
  }

  // Removed downloadTicket method (no PDF needed)

  async remove(id: string): Promise<void> {
    if (!Types.ObjectId.isValid(id))
      throw new BadRequestException("Invalid ticket ID");

    const result = await this.ticketModel.findByIdAndDelete(id).exec();

    if (!result) throw new NotFoundException("Ticket not found");

    // No PDF cleanup needed
  }

  async markAttendance(ticketId: string) {
    try {
      // Find the ticket first
      const ticket = await this.ticketModel.findOne({ ticketId: ticketId });
      if (!ticket) {
        throw new NotFoundException("Ticket Not Found");
      }

      // Update the ticket attendance field to true and return the updated document
      const attendance = await this.ticketModel.findOneAndUpdate(
        { ticketId: ticketId },
        { $set: { attendance: true, isUsed: true } },
        { new: true } // return the updated document
      );

      if (!attendance) {
        throw new NotFoundException("Failed to update attendance");
      }

      return { message: "Attendance Marked True", data: attendance };
    } catch (error) {
      throw error;
    }
  }
}
