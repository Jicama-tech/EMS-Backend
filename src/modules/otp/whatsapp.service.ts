import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import makeWASocket, {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
  WASocket,
} from "baileys";
import * as qrcode from "qrcode";
import * as fs from "fs";

@Injectable()
export class WhatsAppService implements OnModuleInit {
  private readonly logger = new Logger(WhatsAppService.name);
  private sock: WASocket | null = null;
  private reconnecting = false;

  async onModuleInit() {
    await this.initWhatsApp();
  }

  private async initWhatsApp() {
    try {
      const { state, saveCreds } = await useMultiFileAuthState("whatsapp_auth");
      const { version } = await fetchLatestBaileysVersion();

      this.sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: true, // also prints a minimal QR
        browser: ["NestJS", "Chrome", "1.0"],
        syncFullHistory: false,
      });

      this.sock.ev.on("creds.update", saveCreds);

      this.sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect, qr } = update;

        // Show QR in terminal clearly
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

  private toJid(whatsappNumber: string) {
    const digits = whatsappNumber.replace(/\D/g, "");
    console.log(digits, "Shirutpweihfn");
    return `${digits}@s.whatsapp.net`;
  }

  // Fallback pairing method: request pairing code instead of printing QR
  // IMPORTANT: pass phone digits only in E.164 WITHOUT '+' (e.g., +91 987.. => 91987..)
  async requestPairingCode(phoneDigitsE164NoPlus: string) {
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

  async sendMessage(whatsappNumber: string, text: string) {
    if (!this.sock) throw new Error("WhatsApp not connected");
    const jid = this.toJid(whatsappNumber);
    console.log(jid);
    await this.sock.sendMessage(jid, { text });
  }

  async sendMediaMessage(
    whatsappNumber: string,
    filePath: string,
    caption?: string
  ) {
    if (!this.sock) throw new Error("WhatsApp not connected");
    const jid = this.toJid(whatsappNumber);

    // Read the file
    const fileBuffer = await fs.promises.readFile(filePath);

    await this.sock.sendMessage(jid, {
      document: fileBuffer,
      mimetype: "application/pdf",
      fileName: filePath.split("/").pop() || "ticket.pdf",
      caption: caption || "",
    });
  }

  isReady() {
    return !!this.sock;
  }
}
