import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
  NotFoundException,
  OnModuleInit,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose/dist";
import { Model } from "mongoose";
import { CreateOtpDto } from "./dto/create-otp.dto";
import { Otp } from "./entities/otp.entity";
import { MailService } from "../roles/mail.service";

// WhatsApp (Baileys)
import makeWASocket, {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
  WASocket,
} from "baileys";
import * as qrcode from "qrcode";
import { ShopkeepersService } from "../shopkeepers/shopkeepers.service";
import { OrganizersService } from "../organizers/organizers.service";

@Injectable()
export class OtpService implements OnModuleInit {
  private readonly logger = new Logger(OtpService.name);

  // Email/WhatsApp OTP config
  private OTP_LENGTH = 6;
  private EMAIL_TTL_MS = 10 * 60 * 1000; // 10 minutes
  private WHATSAPP_TTL_MS = 5 * 60 * 1000; // 5 minutes
  private RESEND_COOLDOWN_MS = 30 * 1000; // 30s cooldown
  private MAX_ATTEMPTS = 5;

  // WhatsApp socket
  private sock: WASocket | null = null;
  private reconnecting = false;

  constructor(
    @InjectModel(Otp.name) private otpModel: Model<Otp>,
    private mailService: MailService,
    private readonly shopkeeperService: ShopkeepersService,
    private readonly organizerService: OrganizersService
  ) {}

  async onModuleInit() {
    await this.initWhatsApp();
  }

  // =========================
  // WhatsApp INIT/PAIRING
  // =========================
  private async initWhatsApp() {
    try {
      const { state, saveCreds } = await useMultiFileAuthState("whatsapp_auth");
      const { version } = await fetchLatestBaileysVersion();

      this.sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: true, // Baileys prints minimal QR
        browser: ["NestJS", "Chrome", "1.0"],
        syncFullHistory: false,
      });

      this.sock.ev.on("creds.update", saveCreds);

      this.sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          try {
            const termQR = await qrcode.toString(qr, {
              type: "terminal",
              small: true,
            });
            this.logger.log(
              "\nScan this WhatsApp QR with the shop phone:\n" + termQR
            );
            this.logger.log(
              "Open WhatsApp > Linked Devices > Link a device, then scan within ~20s."
            );
          } catch (e) {
            this.logger.error(
              "Failed to render QR. Raw head: " + qr.slice(0, 40) + "..."
            );
          }
        }

        if (connection === "open") {
          this.logger.log("WhatsApp connected.");
          this.reconnecting = false;
        }

        if (connection === "close") {
          const err: any = lastDisconnect?.error;
          const code = err?.output?.statusCode || err?.status || err?.code;
          this.logger.warn(
            `WhatsApp closed. code=${code}. Reconnecting in 1500ms...`
          );
          if (code !== DisconnectReason.loggedOut) {
            if (!this.reconnecting) {
              this.reconnecting = true;
              setTimeout(async () => {
                await this.initWhatsApp();
                this.reconnecting = false;
              }, 1500);
            }
          } else {
            this.logger.error(
              "WhatsApp logged out. Delete whatsapp_auth folder and restart to pair again."
            );
          }
        }
      });
    } catch (e) {
      this.logger.error("WhatsApp init error", e);
    }
  }

  private normalizePhone(input: string) {
    return input.replace(/\D/g, "");
  }

  private toJid(whatsappNumber: string) {
    const digits = this.normalizePhone(whatsappNumber);
    return `${digits}@s.whatsapp.net`;
  }

  // Pairing via code (fallback if QR is troublesome)
  // IMPORTANT: Pass E.164 digits without '+' e.g. +91 987... -> 91987...
  async requestWhatsAppPairingCode(phoneDigitsE164NoPlus: string) {
    if (!this.sock) throw new Error("WhatsApp not initialized yet");
    const anySock: any = this.sock as any;
    if (typeof anySock.requestPairingCode !== "function") {
      throw new Error("Baileys version does not support pairing code API");
    }
    const code: string = await anySock.requestPairingCode(
      phoneDigitsE164NoPlus
    );
    this.logger.log(`Pairing code for ${phoneDigitsE164NoPlus}: ${code}`);
    return code;
  }

  async sendWhatsAppMessage(whatsappNumber: string, text: string) {
    if (!this.sock) throw new Error("WhatsApp not connected");
    const jid = this.toJid(whatsappNumber);
    await this.sock.sendMessage(jid, { text });
  }

  // =========================
  // Legacy scaffolding
  // =========================
  create(createOtpDto: CreateOtpDto) {
    return "This action adds a new otp";
  }

  private generateOtp(length = this.OTP_LENGTH) {
    let s = "";
    while (s.length < length) s += Math.floor(Math.random() * 10).toString();
    return s;
  }

  // =========================
  // Business Email OTP (existing)
  // =========================
  async sendOtp(email: string, role: string) {
    if (!email) throw new BadRequestException("Email is required");
    const otp = Math.floor(100000 + Math.random() * 900000).toString(); // preserves your original method
    const expiresAt = new Date(Date.now() + this.EMAIL_TTL_MS);

    // Cooldown check
    const identifier = email.trim().toLowerCase();
    const channel = "business_email";
    const existing = await this.otpModel.findOne({ channel, role, identifier });
    if (
      existing?.lastSentAt &&
      Date.now() - new Date(existing.lastSentAt).getTime() <
        this.RESEND_COOLDOWN_MS
    ) {
      throw new BadRequestException("Please wait before requesting a new OTP");
    }

    await this.otpModel.findOneAndUpdate(
      { channel, role, identifier },
      {
        // legacy fields kept to not break older data usage
        email,
        otp,
        expiresAt,
        attempts: 0,
        verified: false,
        lastSentAt: new Date(),
        channel,
        identifier,
        role,
      } as any,
      { upsert: true, new: true }
    );

    await this.mailService.sendOtpEmail(email, otp);
  }

  async verifyOtp(email: string, role: string, otp: string) {
    const identifier = email.trim().toLowerCase();
    const channel = "business_email";
    const record = await this.otpModel.findOne({ channel, role, identifier });
    if (!record || record.otp !== otp || record.expiresAt < new Date()) {
      if (record) {
        if (record.attempts + 1 >= this.MAX_ATTEMPTS) {
          await this.otpModel.deleteOne({ channel, role, identifier });
        } else {
          record.attempts += 1;
          await record.save();
        }
      }
      throw new UnauthorizedException("Invalid or expired OTP");
    }
    await this.otpModel.deleteOne({ channel, role, identifier });
    return true;
  }

  // =========================
  // WhatsApp OTP (new)
  // =========================
  async sendWhatsAppOtp(whatsappNumber: string, role: string) {
    if (!whatsappNumber)
      throw new BadRequestException("WhatsApp number is required");
    const digits = this.normalizePhone(whatsappNumber);
    if (digits.length < 8)
      throw new BadRequestException("Invalid WhatsApp number");

    const identifier = digits;
    const channel = "whatsapp";

    const existing = await this.otpModel.findOne({ channel, role, identifier });
    if (
      existing?.lastSentAt &&
      Date.now() - new Date(existing.lastSentAt).getTime() <
        this.RESEND_COOLDOWN_MS
    ) {
      throw new BadRequestException("Please wait before requesting a new OTP");
    }

    const otp = this.generateOtp();
    const expiresAt = new Date(Date.now() + this.WHATSAPP_TTL_MS);

    await this.otpModel.findOneAndUpdate(
      { channel, role, identifier },
      {
        otp,
        expiresAt,
        attempts: 0,
        verified: false,
        lastSentAt: new Date(),
        channel,
        identifier,
        role,
      } as any,
      { upsert: true, new: true }
    );

    const text =
      `Your verification code is ${otp}.\n` +
      `It expires in 5 minutes. Do not share it with anyone.\n\n` +
      `EventSh Verification`;

    await this.sendWhatsAppMessage(digits, text);

    return { message: "OTP sent to WhatsApp" };
  }

  async SendWhatsAppOtp(whatsappNumber: string, role: string) {
    if (!whatsappNumber)
      throw new BadRequestException("WhatsApp number is required");
    const digits = this.normalizePhone(whatsappNumber);
    if (digits.length < 8)
      throw new BadRequestException("Invalid WhatsApp number");

    const identifier = digits;
    const channel = "whatsapp";

    const existing = await this.otpModel.findOne({ channel, role, identifier });
    if (
      existing?.lastSentAt &&
      Date.now() - new Date(existing.lastSentAt).getTime() <
        this.RESEND_COOLDOWN_MS
    ) {
      throw new BadRequestException("Please wait before requesting a new OTP");
    }

    const otp = this.generateOtp();
    const expiresAt = new Date(Date.now() + this.WHATSAPP_TTL_MS);

    await this.otpModel.findOneAndUpdate(
      { channel, role, identifier },
      {
        otp,
        expiresAt,
        attempts: 0,
        verified: false,
        lastSentAt: new Date(),
        channel,
        identifier,
        role,
      } as any,
      { upsert: true, new: true }
    );

    const text =
      `Your verification code is ${otp}.\n` +
      `It expires in 5 minutes. Do not share it with anyone.\n\n` +
      `EventSh Verification`;

    await this.sendWhatsAppMessage(digits, text);

    return { message: "OTP sent to WhatsApp" };
  }

  async verifyWhatsAppOtp(whatsappNumber: string, role: string, otp: string) {
    const digits = this.normalizePhone(whatsappNumber);
    const identifier = digits;
    const channel = "whatsapp";

    const record = await this.otpModel.findOne({ channel, role, identifier });
    if (!record || record.expiresAt < new Date() || record.otp !== otp) {
      if (record) {
        if (record.attempts + 1 >= this.MAX_ATTEMPTS) {
          await this.otpModel.deleteOne({ channel, role, identifier });
        } else {
          record.attempts += 1;
          await record.save();
        }
      }
      throw new UnauthorizedException("Invalid or expired OTP");
    }

    await this.otpModel.deleteOne({ channel, role, identifier });
    return { message: "OTP verified" };
  }

  async VerifyWhatsAppOtp(whatsappNumber: string, role: string, otp: string) {
    const digits = this.normalizePhone(whatsappNumber);
    const identifier = digits;
    const channel = "whatsapp";

    const record = await this.otpModel.findOne({ channel, role, identifier });
    if (!record || record.expiresAt < new Date() || record.otp !== otp) {
      if (record) {
        if (record.attempts + 1 >= this.MAX_ATTEMPTS) {
          await this.otpModel.deleteOne({ channel, role, identifier });
        } else {
          record.attempts += 1;
          await record.save();
        }
      }
      throw new UnauthorizedException("Invalid or expired OTP");
    }

    let token = null;

    if (record.role === "shopkeeper") {
      const shopkeeper =
        await this.shopkeeperService.findByWhatsAppNumber(whatsappNumber);
      if (!shopkeeper) {
        throw new NotFoundException("Token not found");
      }

      token = shopkeeper.token;
    } else {
      const organizer =
        await this.organizerService.findByWhatsAppNumber(whatsappNumber);
      if (!organizer) {
        throw new NotFoundException("Token Not Found");
      }

      token = organizer.token;
    }

    await this.otpModel.deleteOne({ channel, role, identifier });
    return { message: "OTP verified", data: token };
  }

  // =========================
  // Stubs (kept)
  // =========================
  findAll() {
    return `This action returns all otp`;
  }

  findOne(id: number) {
    return `This action returns a #${id} otp`;
  }

  remove(id: number) {
    return `This action removes a #${id} otp`;
  }
}
