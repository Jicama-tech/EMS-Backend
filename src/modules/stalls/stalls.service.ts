import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
  Logger,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import * as QRCode from "qrcode";
import * as fs from "fs";
import * as path from "path";
import * as puppeteer from "puppeteer";
import { CreateStallDto } from "./dto/create-stall.dto";
import { SelectTablesAndAddOnsDto } from "./dto/tableSelect.dto";
import { UpdatePaymentStatusDto } from "./dto/paymentStatus.dto";
import { UpdateStatusDto } from "./dto/updateStatus.dto";
import { Stall, StallDocument } from "./entities/stall.entity";
import { OtpService } from "../otp/otp.service";

@Injectable()
export class StallsService {
  private readonly logger = new Logger(StallsService.name);

  constructor(
    @InjectModel(Stall.name) private stallModel: Model<StallDocument>,
    @InjectModel("Shopkeeper") private shopkeeperModel: Model<any>,
    @InjectModel("Event") private eventModel: Model<any>,
    @InjectModel("Organizer") private organizerModel: Model<any>,
    private otpService: OtpService
  ) {
    // Ensure upload directory exists
    const qrDir = path.join(process.cwd(), "uploads", "stallQRs");
    if (!fs.existsSync(qrDir)) fs.mkdirSync(qrDir, { recursive: true });

    const ticketsDir = path.join(process.cwd(), "uploads", "stallTickets");
    if (!fs.existsSync(ticketsDir))
      fs.mkdirSync(ticketsDir, { recursive: true });
  }

  // ============ PHASE 1: CREATE STALL REQUEST ============

  async createStallRequest(createStallDto: CreateStallDto) {
    try {
      const event = await this.eventModel.findById(createStallDto.eventId);
      if (!event) {
        throw new NotFoundException("Event not found");
      }

      let shopkeeperId: Types.ObjectId;

      if (createStallDto.shopkeeperId) {
        const existingShopkeeper = await this.shopkeeperModel.findById(
          createStallDto.shopkeeperId
        );
        if (!existingShopkeeper) {
          throw new NotFoundException("Shopkeeper not found");
        }
        shopkeeperId = new Types.ObjectId(createStallDto.shopkeeperId);
      } else {
        let shopkeeper = null;

        if (
          createStallDto.shopkeeperWhatsAppNumber ||
          createStallDto.shopkeeperEmail
        ) {
          shopkeeper = await this.shopkeeperModel.findOne({
            $or: [
              ...(createStallDto.shopkeeperWhatsAppNumber
                ? [{ whatsAppNumber: createStallDto.shopkeeperWhatsAppNumber }]
                : []),
              ...(createStallDto.shopkeeperEmail
                ? [{ email: createStallDto.shopkeeperEmail }]
                : []),
            ],
          });
        }

        if (shopkeeper) {
          shopkeeperId = new Types.ObjectId(shopkeeper._id);
        } else {
          if (
            !createStallDto.shopkeeperName ||
            !createStallDto.shopkeeperEmail ||
            !createStallDto.shopkeeperWhatsAppNumber
          ) {
            throw new BadRequestException(
              "Shopkeeper name, email, and WhatsApp number are required for new registration"
            );
          }

          const newShopkeeper = await this.shopkeeperModel.create({
            name: createStallDto.shopkeeperName,
            email: createStallDto.shopkeeperEmail,
            whatsAppNumber: createStallDto.shopkeeperWhatsAppNumber,
            countryCode: createStallDto.shopkeeperCountryCode || "+91",
            phoneNumber: createStallDto.shopkeeperPhoneNumber,
            businessName: createStallDto.businessName,
            businessType: createStallDto.businessType,
            businessDescription: createStallDto.businessDescription,
            address: createStallDto.businessAddress,
            city: createStallDto.businessCity,
            state: createStallDto.businessState,
            pincode: createStallDto.businessPincode,
            isActive: true,
          });

          shopkeeperId = new Types.ObjectId(newShopkeeper._id);
        }
      }

      const existingRequest = await this.stallModel.findOne({
        shopkeeperId,
        eventId: new Types.ObjectId(createStallDto.eventId),
        status: { $nin: ["Cancelled", "Completed"] },
      });

      if (existingRequest) {
        throw new ConflictException(
          "You already have a pending or active stall request for this event"
        );
      }

      const newStall = await this.stallModel.create({
        shopkeeperId,
        eventId: new Types.ObjectId(createStallDto.eventId),
        organizerId: new Types.ObjectId(createStallDto.organizerId),
        status: "Pending",
        paymentStatus: "Unpaid",
        selectedTables: [],
        selectedAddOns: [],
        tablesTotal: 0,
        depositTotal: 0,
        addOnsTotal: 0,
        grandTotal: 0,
        paidAmount: 0,
        remainingAmount: 0,
        requestDate: new Date(),
        notes: createStallDto.notes,
      });

      const populatedStall = await newStall.populate([
        {
          path: "shopkeeperId",
          select: "name email whatsAppNumber businessName",
        },
        { path: "eventId", select: "title location startDate" },
        { path: "organizerId", select: "name email organizationName" },
      ]);

      await this.sendStallCreatedNotification(populatedStall);

      return {
        success: true,
        message:
          "Stall request submitted successfully. Waiting for organizer approval.",
        data: populatedStall,
      };
    } catch (error) {
      if (
        error instanceof ConflictException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      this.logger.error("Error creating stall request:", error);
      return {
        success: false,
        message: error.message,
        data: null,
      };
    }
  }

  // ============ PHASE 2: SELECT TABLES AND ADD-ONS ============

  async selectTablesAndAddOns(
    stallId: string,
    selectDto: SelectTablesAndAddOnsDto
  ) {
    try {
      if (!Types.ObjectId.isValid(stallId)) {
        throw new BadRequestException("Invalid stall ID format");
      }

      const stall = await this.stallModel.findById(stallId).populate("eventId");
      if (!stall) {
        throw new NotFoundException("Stall request not found");
      }

      if (stall.status !== "Confirmed") {
        throw new BadRequestException(
          "Stall request must be confirmed by organizer before selecting tables"
        );
      }

      const event: any = stall.eventId;
      if (!event.venueTables || event.venueTables.length === 0) {
        throw new BadRequestException("No tables available for this event");
      }

      const selectedPositionIds = selectDto.selectedTables.map(
        (t) => t.positionId
      );

      const bookedStalls = await this.stallModel.find({
        eventId: stall.eventId,
        _id: { $ne: stallId },
        status: { $in: ["Processing", "Completed"] },
        "selectedTables.0": { $exists: true },
      });

      const bookedPositionIds = bookedStalls.flatMap((s) =>
        s.selectedTables.map((t) => t.positionId)
      );

      const unavailableTables = selectedPositionIds.filter((posId) =>
        bookedPositionIds.includes(posId)
      );

      if (unavailableTables.length > 0) {
        throw new ConflictException(
          `Some selected tables are no longer available: ${unavailableTables.join(
            ", "
          )}`
        );
      }

      const tablesTotal = selectDto.selectedTables.reduce(
        (sum, table) => sum + table.price,
        0
      );
      const depositTotal = selectDto.selectedTables.reduce(
        (sum, table) => sum + table.depositAmount,
        0
      );
      const addOnsTotal = selectDto.selectedAddOns
        ? selectDto.selectedAddOns.reduce(
            (sum, addon) => sum + addon.price * addon.quantity,
            0
          )
        : 0;
      const grandTotal = tablesTotal + depositTotal + addOnsTotal;

      const updatedStall = await this.stallModel
        .findByIdAndUpdate(
          stallId,
          {
            selectedTables: selectDto.selectedTables,
            selectedAddOns: selectDto.selectedAddOns || [],
            tablesTotal,
            depositTotal,
            addOnsTotal,
            grandTotal,
            remainingAmount: grandTotal,
            status: "Processing",
            selectionDate: new Date(),
            notes: selectDto.notes || stall.notes,
          },
          { new: true }
        )
        .populate([
          {
            path: "shopkeeperId",
            select: "name email whatsAppNumber businessName",
          },
          { path: "eventId", select: "title location startDate" },
          { path: "organizerId", select: "name email organizationName" },
        ]);

      const updatedVenueTables = event.venueTables.map((table: any) => {
        const isSelected = selectedPositionIds.includes(table.positionId);
        return {
          ...table,
          isBooked: isSelected ? true : table.isBooked,
        };
      });

      await this.eventModel.findByIdAndUpdate(
        event._id,
        { venueTables: updatedVenueTables },
        { new: true }
      );

      return {
        success: true,
        message: "Tables and add-ons selected successfully",
        data: updatedStall,
      };
    } catch (error) {
      if (
        error instanceof ConflictException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      this.logger.error("Error selecting tables and add-ons:", error);
      return {
        success: false,
        message: error.message,
        data: null,
      };
    }
  }

  // ============ PHASE 3: PAYMENT & QR CODE - SAME AS TICKETS.SERVICE.TS ============

  /**
   * Confirm payment - Generate QR Code and Stall Ticket PDF (Same as tickets.service.ts)
   */
  async confirmPayment(stallId: string, notes?: string) {
    try {
      if (!Types.ObjectId.isValid(stallId)) {
        throw new BadRequestException("Invalid stall ID format");
      }

      const stall = await this.stallModel
        .findById(stallId)
        .populate("shopkeeperId")
        .populate("eventId")
        .populate("organizerId");

      if (!stall) {
        throw new NotFoundException("Stall request not found");
      }

      // ===== GENERATE SECURE QR PAYLOAD (Same as tickets.service.ts) =====
      const qrPayload = {
        warning:
          "❌ Normal scanners not allowed. Please use the Eventsh app to scan this stall QR.",
        type: "eventsh-stall-checkin",
        stallId: stallId,
        shopkeeperId: (stall.shopkeeperId as any)._id.toString(),
        eventId: (stall.eventId as any)._id.toString(),
        issuedAt: new Date().toISOString(),
      };

      console.log("QR Payload for Stall:", qrPayload);

      // ===== GENERATE QR CODE BASE64 (Same as tickets.service.ts) =====
      const qrCodeBase64 = await QRCode.toDataURL(JSON.stringify(qrPayload), {
        width: 200,
        margin: 2,
      });

      // ===== SAVE QR TO DISK (Same as tickets.service.ts) =====
      await this.saveQRToDisk(qrCodeBase64, stallId);

      // ===== UPDATE PAYMENT STATUS =====
      stall.paymentStatus = "Paid";
      stall.paymentConfirmedDate = new Date();
      stall.status = "Completed";
      stall.completionDate = new Date();
      stall.remainingAmount = 0;
      stall.qrCodePath = qrCodeBase64;
      if (notes) stall.notes = notes;

      await stall.save();

      // ===== GENERATE STALL TICKET PDF (Same as tickets.service.ts) =====
      const shopkeeper = await this.shopkeeperModel.findById(
        stall.shopkeeperId
      );
      const event: any = stall.eventId;

      // Generate PDF with QR code
      const pdfBuffer = await this.generateStallTicketPDF(stall, qrCodeBase64);

      const pdfDir = path.join(process.cwd(), "uploads", "stallTickets");
      if (!fs.existsSync(pdfDir)) fs.mkdirSync(pdfDir, { recursive: true });

      const pdfFileName = `stall_ticket_${stallId}.pdf`;
      const pdfPath = path.join(pdfDir, pdfFileName);

      await fs.promises.writeFile(pdfPath, pdfBuffer);

      // Store path in database
      stall.qrCodePath = `/uploads/stallTickets/${pdfFileName}`;
      stall.qrCodeData = JSON.stringify(qrPayload);
      await stall.save();

      // ===== SEND VIA WHATSAPP (Same as tickets.service.ts) =====
      await this.sendStallTicketViaWhatsApp(
        stall,
        qrCodeBase64,
        shopkeeper.whatsappNumber
      );

      this.logger.log(
        `Payment confirmed and stall ticket sent for stall ${stallId}`
      );

      return {
        success: true,
        message:
          "Payment confirmed and stall ticket PDF sent to shopkeeper via WhatsApp",
        data: stall,
      };
    } catch (error) {
      this.logger.error("Error confirming payment:", error);
      throw error;
    }
  }

  // ===== STALL TICKET HTML GENERATION (Adapted from tickets.service.ts) =====
  private generateStallTicketHTML(stall: Stall, qrBase64: string): string {
    const eventDate = new Date(stall.eventId["startDate"]).toLocaleDateString();

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body {
  font-family: Arial, sans-serif;
  margin: 0;
  padding: 10px 15px;
  background-color: #f5f5f5;
  font-size: 10px; /* Reduced font size */
}
.container {
  max-width: 600px;
  margin: 0 auto;
  background-color: white;
  padding: 15px 20px;
  border-radius: 8px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
}
.header h1 {
  font-size: 22px;
  color: #007bff;
}
.header p {
  font-size: 12px;
  color: #666;
}
.event-title {
  font-size: 20px;
  margin: 15px 0;
}
.details-section {
  margin: 15px 0;
}
.details-section h3 {
  font-size: 12px;
  color: #666;
  margin-bottom: 6px;
  text-transform: uppercase;
}
.detail-row {
  padding: 5px 0;
  border-bottom: 1px solid #eee;
  display: flex;
  justify-content: space-between;
  font-size: 10px;
}
.table-item, .addon-item {
  padding: 6px;
  margin: 3px 0;
  font-size: 9px;
}
.qr-label {
  font-size: 10px;
  color: #666;
  text-align: center;
  margin-bottom: 10px;
}
.qr-section img {
  width: 180px;
  height: 180px;
  margin: 12px 0;
  display: block;
  margin: 0 auto;
  align-self: center;
}
.warning {
  font-size: 10px;
  padding: 10px;
  margin: 15px 0;
}
.footer {
  font-size: 9px;
  padding-top: 10px;
  border-top: 1px solid #eee;
  color: #999;
  text-align: center;
}

        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>EVENTSH STALL CONFIRMATION</h1>
            <p>Your stall has been successfully booked</p>
          </div>

          <div class="event-title">${stall.eventId["title"]}</div>

          <div class="details-section">
            <div class="detail-row">
              <span class="detail-label">Shopkeeper:</span>
              <span class="detail-value">${stall.shopkeeperId["name"]}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Business:</span>
              <span class="detail-value">${stall.shopkeeperId["shopName"] || "N/A"}</span>
            </div>
          </div>

          <div class="details-section">
            <h3>Event Information</h3>
            <div class="detail-row">
              <span class="detail-label">📅 Date:</span>
              <span class="detail-value">${eventDate}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">📍 Venue:</span>
              <span class="detail-value">${stall.eventId["location"] || "N/A"}</span>
            </div>
          </div>

          <div class="details-section">
            <h3>Tables Booked</h3>
            ${stall.selectedTables
              .map(
                (t) => `
              <div class="table-item">
                <strong>${t.tableName}</strong> (${t.tableType})<br>
                Price: $${t.price.toFixed(2)} | Deposit: $${t.depositAmount.toFixed(2)}
              </div>
            `
              )
              .join("")}
          </div>

          ${
            stall.selectedAddOns && stall.selectedAddOns.length > 0
              ? `
            <div class="details-section">
              <h3>Add-ons Selected</h3>
              ${stall.selectedAddOns
                .map(
                  (a) => `
                <div class="addon-item">
                  <strong>${a.name}</strong> x${a.quantity}<br>
                  Price: $${(a.price * a.quantity).toFixed(2)}
                </div>
              `
                )
                .join("")}
            </div>
          `
              : ""
          }

          <div class="details-section">
            <h3>Payment Summary</h3>
            <div class="detail-row">
              <span class="detail-label">Tables Total:</span>
              <span class="detail-value">$${stall.tablesTotal.toFixed(2)}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Deposit Total:</span>
              <span class="detail-value">$${stall.depositTotal.toFixed(2)}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Add-ons Total:</span>
              <span class="detail-value">$${stall.addOnsTotal.toFixed(2)}</span>
            </div>
            <div class="detail-row" style="border: none; font-weight: bold; font-size: 16px; padding: 15px 0;">
              <span class="detail-label">Grand Total:</span>
              <span class="detail-value">$${stall.grandTotal.toFixed(2)}</span>
            </div>
          </div>

          <div class="qr-section">
            <p class="qr-label">Scan at Event Entrance</p>
            <img src="${qrBase64}" alt="Stall Entry QR Code">
          </div>

          <div class="warning">
            ⚠️ <strong>Important:</strong> This QR code can ONLY be scanned using the official Eventsh app. 
            Normal camera scanners will not work. 
            Show this QR code at the venue entrance for check-in and check-out.
            The Deposit will be Returned after the Event is Finished.
          </div>

          <div class="footer">
            © ${new Date().getFullYear()} Eventsh. All rights reserved.
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // ===== GENERATE STALL TICKET PDF (Same pattern as tickets.service.ts) =====
  private async generateStallTicketPDF(
    stall: Stall,
    qrBase64: string
  ): Promise<Buffer> {
    const html = this.generateStallTicketHTML(stall, qrBase64);

    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });

    const uint8arrayBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "10mm", bottom: "0mm", left: "0mm", right: "0mm" },
    });

    await browser.close();

    const buffer = Buffer.from(uint8arrayBuffer);
    return buffer;
  }

  // ===== SEND STALL TICKET VIA WHATSAPP (Same pattern as tickets.service.ts) =====
  private async sendStallTicketViaWhatsApp(
    stall: Stall,
    qrBase64: string,
    whatsappNumber: string
  ): Promise<void> {
    try {
      console.log("Sending stall ticket via WhatsApp");

      const pdfBuffer = await this.generateStallTicketPDF(stall, qrBase64);
      const pdfDir = path.join(process.cwd(), "uploads", "stallTickets");

      if (!fs.existsSync(pdfDir)) fs.mkdirSync(pdfDir, { recursive: true });

      const event = await this.eventModel.findOne(stall.eventId);

      const pdfFileName = `stall_ticket_${event.title}.pdf`;
      const pdfPath = path.join(pdfDir, pdfFileName);

      await fs.promises.writeFile(pdfPath, pdfBuffer);

      const eventDate = new Date(
        stall.eventId["startDate"]
      ).toLocaleDateString();

      const message = `🎉 *Your Stall Confirmation is Ready!*

🎪 *Stall:* Confirmed for ${stall.eventId["title"]}

👤 *Business:* ${stall.shopkeeperId["name"]}

📅 *Date:* ${eventDate}

📍 *Venue:* ${stall.eventId["location"] || "N/A"}

📊 *Booking Summary:*
• Tables: ${stall.selectedTables.length}
• Add-ons: ${stall.selectedAddOns?.length || 0}
• Total Amount: $${stall.grandTotal.toFixed(2)}

⚠️ *Important:* Your stall ticket PDF is attached. 
Please save it and present the QR code at the event entrance.

The QR code can ONLY be scanned using the official Eventsh app.

Thank you for choosing Eventsh! 🎊`;

      // Send WhatsApp message
      await this.otpService.sendWhatsAppMessage(whatsappNumber, message);

      // Send PDF as media
      await this.otpService.sendMediaMessage(
        whatsappNumber,
        pdfPath,
        `🎪 Your stall confirmation for ${stall.eventId["title"]}`
      );

      console.log("Stall ticket sent successfully via WhatsApp");
    } catch (error) {
      this.logger.error("Error sending stall ticket via WhatsApp:", error);
      throw error;
    }
  }

  // ===== SAVE QR TO DISK (Same as tickets.service.ts) =====
  private async saveQRToDisk(
    base64Data: string,
    stallId: string
  ): Promise<string> {
    const qrDir = path.join(process.cwd(), "uploads", "stallQRs");
    const fileName = `qr_${stallId}.png`;
    const filePath = path.join(qrDir, fileName);

    const buffer = Buffer.from(base64Data.split(",")[1], "base64");
    await fs.promises.writeFile(filePath, buffer);

    console.log("QR code saved to:", filePath);
    return filePath;
  }

  // ============ QR CODE SCANNING & ATTENDANCE ============

  async scanStallQR(qrCodeData: string) {
    try {
      // Parse QR data
      const qrData = JSON.parse(qrCodeData);

      if (qrData.type !== "eventsh-stall-checkin") {
        throw new BadRequestException("Invalid QR code type");
      }

      const stall = await this.stallModel
        .findById(qrData.stallId)
        .populate("shopkeeperId")
        .populate("eventId");

      if (!stall) {
        throw new NotFoundException("Stall not found");
      }

      // Verify QR code matches
      const storedQrData = JSON.parse(stall.qrCodeData || "{}");
      if (
        storedQrData.stallId !== qrData.stallId ||
        storedQrData.shopkeeperId !== qrData.shopkeeperId
      ) {
        throw new BadRequestException("Invalid QR code");
      }

      const shopkeeper = await this.shopkeeperModel.findById(
        stall.shopkeeperId
      );

      const now = new Date();

      // First scan - Check-in
      if (stall.hasCheckedIn === false && stall.hasCheckedOut === false) {
        stall.checkInTime = now;
        stall.hasCheckedIn = true;
        await stall.save();

        const shopkeeper = await this.shopkeeperModel.findById(
          stall.shopkeeperId
        );
        const message =
          `✅ *Check-in Successful*\n\n` +
          `Welcome ${shopkeeper.name}!\n` +
          `Check-in time: ${now.toLocaleString()}\n\n` +
          `Your stall is now open. Enjoy the event! 🎉`;

        await this.otpService.sendWhatsAppMessage(
          shopkeeper.whatsappNumber,
          message
        );

        return {
          success: true,
          message: "Check-in successful",
          data: {
            action: "CHECK_IN",
            stallId: stall._id,
            checkInTime: stall.checkInTime,
            shopkeeper: stall.shopkeeperId,
            eventId: stall.eventId,
            businessType: shopkeeper.businessCategory,
            Tables: stall.selectedTables,
            AddOns: stall.selectedAddOns,
            Amount: stall.grandTotal,
            paidAmount: stall.paidAmount,
            checkinTime: stall.checkInTime,
            remainingAmount: stall.remainingAmount,
          },
        };
      }

      // Second scan - Check-out
      if (stall.hasCheckedIn === true && stall.hasCheckedOut === false) {
        stall.checkOutTime = now;
        stall.hasCheckedOut = true;
        await stall.save();

        const shopkeeper = await this.shopkeeperModel.findById(
          stall.shopkeeperId
        );
        const duration = Math.floor(
          (now.getTime() - stall.checkInTime.getTime()) / (1000 * 60)
        );

        const message =
          `👋 *Check-out Successful*\n\n` +
          `Goodbye ${shopkeeper.name}!\n` +
          `Check-out time: ${now.toLocaleString()}\n` +
          `Duration: ${duration} minutes\n\n` +
          `Thank you for participating! 🙏`;

        await this.otpService.sendWhatsAppMessage(
          shopkeeper.whatsappNumber,
          message
        );

        return {
          success: true,
          message: "Check-out successful",
          data: {
            action: "CHECK_OUT",
            stallId: stall._id,
            checkInTime: stall.checkInTime,
            shopkeeper: stall.shopkeeperId,
            eventId: stall.eventId,
            businessType: shopkeeper.businessCategory,
            Tables: stall.selectedTables,
            AddOns: stall.selectedAddOns,
            Amount: stall.grandTotal,
            paidAmount: stall.paidAmount,
            checkinTime: stall.checkInTime,
            remainingAmount: stall.remainingAmount,
          },
        };
      }

      throw new BadRequestException("Stall has already been checked out");
    } catch (error) {
      this.logger.error("Error scanning QR:", error);
      throw error;
    }
  }

  // ============ OTHER UTILITY METHODS ============

  async getStallAttendance(stallId: string) {
    try {
      if (!Types.ObjectId.isValid(stallId)) {
        throw new BadRequestException("Invalid stall ID");
      }

      const stall = await this.stallModel
        .findById(stallId)
        .select(
          "checkInTime checkOutTime hasCheckedIn hasCheckedOut shopkeeperId"
        )
        .populate("shopkeeperId", "name email");

      if (!stall) {
        throw new NotFoundException("Stall not found");
      }

      return {
        success: true,
        data: {
          checkInTime: stall.checkInTime,
          checkOutTime: stall.checkOutTime,
          hasCheckedIn: stall.hasCheckedIn,
          hasCheckedOut: stall.hasCheckedOut,
          shopkeeper: stall.shopkeeperId,
        },
      };
    } catch (error) {
      throw error;
    }
  }

  private async sendStallCreatedNotification(stall: any) {
    try {
      const shopkeeper = await this.shopkeeperModel.findById(
        stall.shopkeeperId
      );

      const event: any = stall.eventId;

      const message =
        `🎪 *Stall Request Submitted*\n\n` +
        `Dear ${shopkeeper.name},\n\n` +
        `Your stall request for *${event.title}* has been submitted successfully.\n\n` +
        `📋 *Event Details:*\n` +
        `• Event: ${event.title}\n` +
        `• Location: ${event.location}\n` +
        `• Date: ${new Date(event.startDate).toLocaleDateString()}\n\n` +
        `Your request is now pending organizer approval.\n\n` +
        `Thank you! 🙏`;

      await this.otpService.sendWhatsAppMessage(
        shopkeeper.whatsappNumber,
        message
      );
    } catch (error) {
      this.logger.error("Error sending stall created notification:", error);
    }
  }

  private async sendStatusUpdateNotification(
    stall: any,
    oldStatus: string,
    newStatus: string
  ) {
    try {
      const shopkeeper = await this.shopkeeperModel.findById(
        stall.shopkeeperId
      );
      const event: any = stall.eventId;

      let message = "";

      if (newStatus === "Confirmed") {
        message =
          `✅ *Stall Request Approved!*\n\n` +
          `Congratulations ${shopkeeper.name}!\n\n` +
          `Your stall request for *${event.title}* has been approved.\n\n` +
          `📋 *Next Steps:*\n` +
          `1. Select your preferred tables\n` +
          `2. Choose add-ons (if any)\n` +
          `3. Complete payment\n\n` +
          `Please log in to proceed. 🎉`;
      } else if (newStatus === "Cancelled") {
        message =
          `❌ *Stall Request Cancelled*\n\n` +
          `Dear ${shopkeeper.name},\n\n` +
          `Your stall request for *${event.title}* has been cancelled.\n\n` +
          `Reason: ${stall.cancellationReason || "Not specified"}\n\n` +
          `Please contact the organizer for more information.`;
      }

      if (message) {
        await this.otpService.sendWhatsAppMessage(
          shopkeeper.whatsappNumber,
          message
        );
      }
    } catch (error) {
      this.logger.error("Error sending status update notification:", error);
    }
  }

  private async sendPaymentStatusNotification(
    stall: any,
    oldPaymentStatus: string,
    newPaymentStatus: string
  ) {
    try {
      const shopkeeper = await this.shopkeeperModel.findById(
        stall.shopkeeperId
      );
      const event: any = stall.eventId;

      let message = "";

      const paidAmount =
        stall.tablesTotal + stall.depositTotal + stall.addOnsTotal;

      const remaining = stall.grandTotal - paidAmount;

      if (newPaymentStatus === "Partial") {
        message =
          `💰 *Partial Payment Received*\n\n` +
          `Dear ${shopkeeper.name},\n\n` +
          `We've received your partial payment for *${event.title}*.\n\n` +
          `• Amount Paid: $${paidAmount}\n` +
          `• Remaining: $${remaining}\n` +
          `• Total: $${stall.grandTotal}\n\n` +
          `Please complete the remaining payment.`;
      } else if (newPaymentStatus === "Paid") {
        message =
          `✅ *Payment Completed!*\n\n` +
          `Dear ${shopkeeper.name},\n\n` +
          `Your payment for *${event.title}* has been processed!\n\n` +
          `💵 *Total Paid:* $${stall.paidAmount}\n\n` +
          `Your booking is confirmed. Ticket PDF will be sent shortly. 🎉`;
      }

      stall.paidAmount = paidAmount;
      stall.remainingAmount = remaining;
      await stall.save();

      if (message) {
        await this.otpService.sendWhatsAppMessage(
          shopkeeper.whatsappNumber,
          message
        );
      }
    } catch (error) {
      this.logger.error("Error sending payment status notification:", error);
    }
  }

  async checkExistingRequest(eventId: string, shopkeeperId: string) {
    try {
      if (
        !Types.ObjectId.isValid(eventId) ||
        !Types.ObjectId.isValid(shopkeeperId)
      ) {
        throw new BadRequestException(
          "Invalid event ID or shopkeeper ID format"
        );
      }

      const existingRequest = await this.stallModel
        .findOne({
          shopkeeperId: new Types.ObjectId(shopkeeperId),
          eventId: new Types.ObjectId(eventId),
        })
        .populate([
          {
            path: "shopkeeperId",
            select: "name email whatsAppNumber businessName",
          },
          {
            path: "eventId",
            select: "title location startDate venueTables addOnItems",
          },
          { path: "organizerId", select: "name email organizationName" },
        ])
        .sort({ createdAt: -1 }); // Get most recent request

      if (!existingRequest) {
        return {
          success: true,
          message: "No existing request found",
          data: null,
        };
      }

      if (
        existingRequest.status === "Cancelled" ||
        existingRequest.status === "Completed"
      ) {
        return {
          success: true,
          status: existingRequest.status,
          message: `Existing request is ${existingRequest.status}`,
          data: existingRequest,
        };
      }

      return {
        success: true,
        message: "Existing request found",
        data: existingRequest,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        data: null,
      };
    }
  }

  async updatePaymentStatus(
    stallId: string,
    updateDto: UpdatePaymentStatusDto
  ) {
    try {
      if (!Types.ObjectId.isValid(stallId)) {
        throw new BadRequestException("Invalid stall ID format");
      }

      const stall = await this.stallModel.findById(stallId);
      if (!stall) {
        throw new NotFoundException("Stall request not found");
      }

      const oldPaymentStatus = stall.paymentStatus;

      const updateData: any = {
        paymentStatus: updateDto.paymentStatus,
        notes: updateDto.notes || stall.notes,
      };

      if (
        updateDto.paymentStatus === "Paid" ||
        updateDto.paymentStatus === "Partial"
      ) {
        if (updateDto.paymentStatus === "Paid") {
          await this.confirmPayment(stallId, updateDto.notes);
        }
        if (updateDto.paymentStatus === "Partial") {
          await this.sendPaymentStatusNotification(
            stall,
            oldPaymentStatus,
            updateDto.paymentStatus
          );
        }
        updateData.paymentDate = new Date();
      }

      const updatedStall = await this.stallModel
        .findByIdAndUpdate(stallId, updateData, { new: true })
        .populate([
          {
            path: "shopkeeperId",
            select: "name email whatsAppNumber businessName",
          },
          { path: "eventId", select: "title location startDate" },
          { path: "organizerId", select: "name email organizationName" },
        ]);

      return {
        success: true,
        message: "Payment status updated successfully",
        data: updatedStall,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        data: null,
      };
    }
  }

  async updateStatus(stallId: string, updateDto: UpdateStatusDto) {
    try {
      if (!Types.ObjectId.isValid(stallId)) {
        throw new BadRequestException("Invalid stall ID format");
      }

      const stall = await this.stallModel.findById(stallId);
      if (!stall) {
        throw new NotFoundException("Stall request not found");
      }

      const oldStatus = stall.status;

      const updateData: any = {
        status: updateDto.status,
        notes: updateDto.notes || stall.notes,
      };

      if (updateDto.status === "Confirmed") {
        updateData.confirmationDate = new Date();
      }

      if (updateDto.status === "Cancelled") {
        updateData.cancellationReason = updateDto.cancellationReason;
      }

      const updatedStall = await this.stallModel
        .findByIdAndUpdate(stallId, updateData, { new: true })
        .populate([
          {
            path: "shopkeeperId",
            select: "name email whatsAppNumber businessName",
          },
          { path: "eventId", select: "title location startDate" },
          { path: "organizerId", select: "name email organizationName" },
        ]);

      await this.sendStatusUpdateNotification(
        updatedStall,
        oldStatus,
        updateDto.status
      );

      return {
        success: true,
        message: `Stall request ${updateDto.status.toLowerCase()} successfully`,
        data: updatedStall,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        data: null,
      };
    }
  }

  async findAll() {
    try {
      const stalls = await this.stallModel
        .find()
        .populate([
          {
            path: "shopkeeperId",
            select: "name email whatsAppNumber businessName",
          },
          { path: "eventId", select: "title location startDate" },
          { path: "organizerId", select: "name email organizationName" },
        ])
        .sort({ createdAt: -1 });

      return {
        success: true,
        message: "Stalls fetched successfully",
        data: stalls,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        data: null,
      };
    }
  }

  async findOne(id: string) {
    try {
      if (!Types.ObjectId.isValid(id)) {
        throw new BadRequestException("Invalid stall ID format");
      }

      const stall = await this.stallModel.findById(id).populate([
        {
          path: "shopkeeperId",
          select: "name email whatsAppNumber businessName",
        },
        {
          path: "eventId",
          select: "title location startDate venueTables addOnItems venueConfig",
        },
        { path: "organizerId", select: "name email organizationName" },
      ]);

      if (!stall) {
        throw new NotFoundException("Stall not found");
      }

      return {
        success: true,
        message: "Stall fetched successfully",
        data: stall,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        data: null,
      };
    }
  }

  async findByEventId(eventId: string) {
    try {
      if (!Types.ObjectId.isValid(eventId)) {
        throw new BadRequestException("Invalid event ID format");
      }

      const stalls = await this.stallModel
        .find({ eventId: new Types.ObjectId(eventId) })
        .populate([
          {
            path: "shopkeeperId",
            select: "name email whatsAppNumber businessName",
          },
          { path: "organizerId", select: "name email organizationName" },
        ])
        .sort({ createdAt: -1 });

      return {
        success: true,
        message: "Stalls for event fetched successfully",
        data: stalls,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        data: null,
      };
    }
  }

  async findByOrganizerId(organizerId: string) {
    try {
      if (!Types.ObjectId.isValid(organizerId)) {
        throw new BadRequestException("Invalid organizer ID format");
      }

      const stalls = await this.stallModel
        .find({ organizerId: new Types.ObjectId(organizerId) })
        .populate([
          {
            path: "shopkeeperId",
            select: "name email whatsappNumber shopName businessEmail phone",
          },
          { path: "eventId", select: "title location startDate endDate" },
        ])
        .sort({ createdAt: -1 });

      return {
        success: true,
        message: "Stalls for organizer fetched successfully",
        data: stalls,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        data: null,
      };
    }
  }

  async findByShopkeeperId(shopkeeperId: string) {
    try {
      if (!Types.ObjectId.isValid(shopkeeperId)) {
        throw new BadRequestException("Invalid shopkeeper ID format");
      }

      const stalls = await this.stallModel
        .find({ shopkeeperId: new Types.ObjectId(shopkeeperId) })
        .populate([
          { path: "eventId", select: "title location startDate image endDate" },
          {
            path: "organizerId",
            select: "name email organizationName businessEmail whatsAppNumber",
          },
        ])
        .sort({ createdAt: -1 });

      return {
        success: true,
        message: "Stalls for shopkeeper fetched successfully",
        data: stalls,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        data: null,
      };
    }
  }

  async remove(id: string) {
    try {
      if (!Types.ObjectId.isValid(id)) {
        throw new BadRequestException("Invalid stall ID format");
      }

      const stall = await this.stallModel.findByIdAndDelete(id);
      if (!stall) {
        throw new NotFoundException("Stall not found");
      }

      return {
        success: true,
        message: "Stall deleted successfully",
        data: null,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        data: null,
      };
    }
  }

  async getAvailableTables(eventId: string) {
    try {
      if (!Types.ObjectId.isValid(eventId)) {
        throw new BadRequestException("Invalid event ID format");
      }

      const event = await this.eventModel.findById(eventId);
      if (!event) {
        throw new NotFoundException("Event not found");
      }

      if (!event.venueTables || event.venueTables.length === 0) {
        return {
          success: true,
          message: "No tables configured for this event",
          data: {
            allTables: [],
            bookedTables: [],
            availableTables: [],
          },
        };
      }

      const bookedStalls = await this.stallModel.find({
        eventId: new Types.ObjectId(eventId),
        status: { $in: ["Processing", "Completed"] },
        "selectedTables.0": { $exists: true },
      });

      const bookedPositionIds = bookedStalls.flatMap((s) =>
        (s.selectedTables || []).map((t) => t.positionId)
      );

      const tablesWithStatus = event.venueTables.map((table) => ({
        ...table,
        isBooked: bookedPositionIds.includes(table.positionId),
      }));

      const availableTables = tablesWithStatus.filter((t) => !t.isBooked);
      const bookedTables = tablesWithStatus.filter((t) => t.isBooked);

      return {
        success: true,
        message: "Tables fetched successfully",
        data: {
          allTables: tablesWithStatus,
          bookedTables,
          availableTables,
          venueConfig: event.venueConfig,
          addOnItems: event.addOnItems || [],
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        data: null,
      };
    }
  }

  private async sendDepositReturnedNotification(stall: any) {
    try {
      const shopkeeper = await this.shopkeeperModel.findById(
        stall.shopkeeperId
      );
      const event = await this.eventModel.findById(stall.eventId);
      const organizer = await this.organizerModel.findById(stall.organizerId);

      const returnedAmount = stall.depositTotal; // adjust if this is your returned deposit

      let message =
        `🔄 *Deposit Returned*\n\n` +
        `Dear ${shopkeeper.name},\n\n` +
        `Your deposit for *${event.title}* has been successfully returned to your account.\n\n` +
        `• Amount Returned: $${returnedAmount}\n\n` +
        `Thank you for your participation!\n\n` +
        `We'd love to hear about your experience. Please reply with any feedback or use our feedback:\n\n` +
        `Best regards, ${organizer.organizationName}`;

      // Mark the deposit returned (optional business logic)
      stall.depositReturned = true;
      await stall.save();

      await this.otpService.sendWhatsAppMessage(
        shopkeeper.whatsappNumber,
        message
      );
    } catch (error) {
      this.logger.error("Error sending deposit returned notification:", error);
    }
  }

  async returnedDeposit(stallId: string) {
    try {
      const stall = await this.stallModel.findById(stallId);

      if (stall.hasCheckedOut && stall.checkOutTime) {
        const now = new Date();
        stall.depositReturned = true;
        stall.depositReturnedDate = now;
        await stall.save();

        await this.sendDepositReturnedNotification(stall);
      }

      return {
        success: true,
        message: "Deposit returned successfully",
        data: stall,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        data: null,
      };
    }
  }
}
