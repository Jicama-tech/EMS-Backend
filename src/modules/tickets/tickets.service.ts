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
import { MailService } from "../roles/mail.service";
import { OtpService } from "../otp/otp.service";
import * as puppeteer from "puppeteer";
import { User } from "../users/schemas/user.schema";
import { UsersService } from "../users/users.service";

@Injectable()
export class TicketsService {
  constructor(
    @InjectModel(Ticket.name) private ticketModel: Model<TicketDocument>,
    @InjectModel(Event.name) private eventModel: Model<Event>,
    @InjectModel(Organizer.name) private organizerModel: Model<Organizer>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    private readonly usersService: UsersService,
    private mailService: MailService,
    private otpService: OtpService
  ) {
    const qrDir = path.join(process.cwd(), "uploads", "generatedQRs");
    if (!fs.existsSync(qrDir)) fs.mkdirSync(qrDir, { recursive: true });
  }

  async create(createTicketDto: CreateTicketDto): Promise<Ticket> {
    try {
      // 1. Find or create user by WhatsApp number
      let user = await this.userModel
        .findOne({
          whatsAppNumber: createTicketDto.customerDetails.whatsapp,
        })
        .exec();

      if (!user) {
        // Create new user record
        const createUserDto = {
          name:
            `${createTicketDto.customerDetails.firstName} ${createTicketDto.customerDetails.lastName}` ||
            "Guest User",
          email: createTicketDto.customerDetails.email || null,
          password: null,
          provider: "whatsapp",
          providerId: null,
          whatsAppNumber: createTicketDto.customerDetails.whatsapp,
        };
        user = await this.usersService.create(createUserDto);
      }

      // Use email from user record if available
      const ticketEmail =
        user.email || createTicketDto.customerDetails.email || null;

      // 2. Ticket details setup
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

      // 3. Generate secure QR payload
      const qrPayload = {
        warning:
          "❌ Normal scanners not allowed. Please use the Eventsh app to scan this ticket.",
        type: "eventsh-ticket",
        ticketId: createTicketDto.ticketId,
        eventId: createTicketDto.eventId,
        issuedAt: new Date().toISOString(),
      };

      console.log("QR Payload:", qrPayload);

      const qrCodeBase64 = await QRCode.toDataURL(JSON.stringify(qrPayload), {
        width: 200,
        margin: 2,
      });
      await this.saveQRToDisk(qrCodeBase64, createTicketDto.ticketId);

      // 4. Create the ticket document
      const ticket = new this.ticketModel({
        ticketId: createTicketDto.ticketId,
        eventId: new Types.ObjectId(createTicketDto.eventId),
        organizerId: new Types.ObjectId(createTicketDto.organizerId),
        eventTitle: createTicketDto.eventInfo.title,
        eventDate: new Date(createTicketDto.eventInfo.date),
        eventTime: createTicketDto.eventInfo.time,
        eventVenue: createTicketDto.eventInfo.venue,
        customerName,
        customerEmail: ticketEmail,
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
        // Optional: may want to store a userId/reference here as well
        userId: user._id,
      });

      const savedTicket = await ticket.save();
      await this.updateEventTicketCount(createTicketDto.eventId, totalQuantity);

      // 5. Delivery - WhatsApp or Email fallback (prefer WhatsApp)
      if (savedTicket.customerWhatsapp) {
        console.log("called");
        try {
          await this.sendTicketViaWhatsApp(
            savedTicket,
            qrCodeBase64,
            savedTicket.customerWhatsapp
          );
        } catch (error) {
          throw error;
          // if (ticketEmail) {
          //   await this.sendTicketViaEmail(savedTicket, qrCodeBase64);
          // }
        }
      } else if (ticketEmail) {
        await this.sendTicketViaEmail(savedTicket, qrCodeBase64);
      }

      return savedTicket;
    } catch (error) {
      throw new InternalServerErrorException(
        `Failed to create ticket: ${error.message}`
      );
    }
  }

  // --- Puppeteer PDF Generation ---
  private generateTicketHTML(ticket: Ticket, qrBase64: string): string {
    const eventDate = new Date(ticket.eventDate).toLocaleDateString();
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Eventsh Ticket</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap');
        body { font-family: 'Roboto', Arial, sans-serif; margin:0;background:#fff;color:#18181b; }
        .header { background:#3b82f6; color:white; text-align:center; padding:36px 24px 22px;}
        .header h1 { margin:0; font-size:32px; }
        .header .subtitle { margin:7px 0 0 0; font-size:19px; opacity:0.93; }
        .container { max-width:650px; margin:0 auto; background:white; border:2.5px solid #e5e7eb; border-radius:15px; overflow:hidden; }
        .details { padding:28px;}
        .detailsTitle { font-size:22px; font-weight:bold; margin-bottom:18px; color:#1e293b;}
        .info { background:#f3f4f6; border-radius:9px; padding:16px 20px; margin-bottom:18px;}
        .info p { margin:0 0 5px 0; font-size:16px; line-height:1.45;}
        .ticket-breakdown { background:#f9fafb; border-radius:8px; padding:12px 18px; margin-bottom:18px; font-size:14px;}
        .qr-section {margin:25px 0; text-align:center;}
        .qr-section img { border-radius:10px; border:2px solid #e5e7eb; width:200px; height:200px; margin-bottom:7px;}
        .info-warning { background:#fef2f2; border:1.5px solid #fecaca; border-radius:10px; margin-top:16px; color:#dc2626; padding:10px 12px; font-size:14.5px;}
        .footer {padding:13px; background:#f1f5f9; color:#64748b; font-size:12px; text-align:center; border-top:2px solid #e5e7eb;}
        .bold {font-weight:bold;}
        .emoji {font-size:18px; margin-right:7px; vertical-align:-2px;}
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>EVENTSH TICKET</h1>
          <div class="subtitle">${ticket.eventTitle}</div>
        </div>
        <div class="details">
          <div class="detailsTitle">Ticket Details</div>
          <div class="info">
            <p><span class="emoji">🎫</span><span class="bold">Ticket ID:</span> ${ticket.ticketId}</p>
            <p><span class="emoji">👤</span><span class="bold">Attendee:</span> ${ticket.customerName}</p>
            <p><span class="emoji">📅</span><span class="bold">Date:</span> ${eventDate}</p>
            <p><span class="emoji">🕒</span><span class="bold">Time:</span> ${ticket.eventTime || "N/A"}</p>
            <p><span class="emoji">📍</span><span class="bold">Venue:</span> ${ticket.eventVenue || "N/A"}</p>
            <p><span class="emoji">💰</span><span class="bold">Total:</span> $${ticket.totalAmount?.toFixed(2) || "0.00"}</p>
          </div>
          <div class="qr-section">
            <div style="font-size:16px; margin-bottom:5px;">Scan at Event Entrance</div>
            <img src="${qrBase64}" alt="Ticket QR Code" />
          </div>
          <div class="info-warning">
            <span class="emoji">⚠️</span>
            <span>This QR code can ONLY be scanned using the official Eventsh app. Normal camera scanners will not work.</span>
          </div>
        </div>
        <div class="footer">© ${new Date().getFullYear()} Eventsh. All rights reserved.</div>
      </div>
    </body>
    </html>`;
  }

  private async generateTicketPDF(
    ticket: Ticket,
    qrBase64: string
  ): Promise<Buffer> {
    const html = this.generateTicketHTML(ticket, qrBase64);
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const uint8arrayBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0mm", bottom: "0mm", left: "0mm", right: "0mm" },
    });
    await browser.close();
    const buffer = Buffer.from(uint8arrayBuffer);
    return buffer;
  }

  private async sendTicketViaWhatsApp(
    ticket: Ticket,
    qrBase64: string,
    whatsappNumber: string
  ): Promise<void> {
    try {
      console.log("Called 1");
      const pdfBuffer = await this.generateTicketPDF(ticket, qrBase64);
      const pdfDir = path.join(process.cwd(), "uploads", "tickets");
      if (!fs.existsSync(pdfDir)) fs.mkdirSync(pdfDir, { recursive: true });
      const pdfFileName = `ticket_${ticket.ticketId}.pdf`;
      const pdfPath = path.join(pdfDir, pdfFileName);
      await fs.promises.writeFile(pdfPath, pdfBuffer);

      const eventDate = new Date(ticket.eventDate).toLocaleDateString();
      const message = `🎉 *Your Eventsh Ticket is Ready!*

🎫 *Event:* ${ticket.eventTitle}
👤 *Attendee:* ${ticket.customerName}
📅 *Date:* ${eventDate}
🕒 *Time:* ${ticket.eventTime || "N/A"}
📍 *Venue:* ${ticket.eventVenue || "N/A"}
💰 *Total Amount:* $${ticket.totalAmount?.toFixed(2) || "0.00"}

⚠️ *Important:* Your ticket PDF is attached. Please save it and present the QR code at the event entrance.
The QR code can ONLY be scanned using the official Eventsh app.

Thank you for choosing Eventsh! 🎊`;

      await this.otpService.sendWhatsAppMessage(whatsappNumber, message);
      await this.otpService.sendMediaMessage(
        whatsappNumber,
        pdfPath,
        `🎫 Your ticket for ${ticket.eventTitle}`
      );
    } catch (error) {
      throw error;
    }
  }

  private async sendTicketViaEmail(
    ticket: Ticket,
    qrBase64: string
  ): Promise<void> {
    try {
      const eventDate = new Date(ticket.eventDate).toLocaleDateString();
      const html = `
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
        </div>`;
      await this.mailService.sendEmail({
        to: ticket.customerEmail,
        subject: `🎟️ Your Eventsh Ticket - ${ticket.eventTitle}`,
        html,
        attachments: [
          {
            filename: "ticket-qrcode.png",
            content: qrBase64.split(",")[1],
            encoding: "base64",
            cid: "qrcodeeventsh",
          },
        ],
      });
    } catch (error) {
      throw error;
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
