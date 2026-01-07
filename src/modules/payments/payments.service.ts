import { Injectable, BadRequestException } from "@nestjs/common";
import * as QRCode from "qrcode"; // Fixed import
import * as crc from "crc";
import { Jimp } from "jimp";
const QrCodeReader = require("qrcode-reader");
import { PaymentQrConfig, PaymentScheme } from "./payment-Qr.interface";
import { URLSearchParams } from "url";
import fetch from "node-fetch"; // npm install node-fetch
import { Buffer } from "buffer";
import { Readable } from "stream";
import {
  MultiFormatReader,
  BarcodeFormat,
  DecodeHintType,
  RGBLuminanceSource,
  BinaryBitmap,
  HybridBinarizer,
} from "@zxing/library";
import { loadImage, createCanvas } from "canvas";

@Injectable()
export class PaymentsService {
  // Generate EMVCo TLV string helper
  private tlv(id: string, value: string): string {
    const len = value.length.toString().padStart(2, "0");
    return `${id}${len}${value}`;
  }

  // CRC16 CCITT-FALSE per EMVCo spec
  private calculateCRC(payload: string): string {
    const data = Buffer.from(payload, "utf-8");
    const crcValue = crc.crc16ccitt(data, 0xffff);
    return crcValue.toString(16).toUpperCase().padStart(4, "0");
  }

  private currencyMap: Record<string, string> = {
    USD: "840",
    INR: "356",
    SGD: "702",
  };

  private getCurrencyCode(currency: string): string {
    const upper = (currency || "INR").toUpperCase();
    return this.currencyMap[upper] || "356"; // Default to INR
  }

  // Build Payment QR payload (EMVCo) dynamically for PayNow or UPI
  async buildPayload(config: PaymentQrConfig, refId?: string): Promise<string> {
    if (!config.payeeId || !config.payeeName || !config.scheme) {
      throw new BadRequestException("Missing required payment config");
    }
    if (isNaN(Number(config.amount)) || Number(config.amount) <= 0) {
      throw new BadRequestException("Invalid amount");
    }

    const payloadHeader = this.tlv("00", "01") + this.tlv("01", "12");

    let merchantAccountInfo = "";
    if (config.scheme === "PAYNOW") {
      const proxyTypeValue = config.payeeId.match(/^\d{9}[A-Z]$/) ? "2" : "0";
      const proxyValue = config.payeeId.replace(/[\s+]/g, "");
      const editableFlag = config.editableAmount ? "0" : "1";
      const mai =
        this.tlv("00", "SG.PAYNOW") +
        this.tlv("01", proxyTypeValue) +
        this.tlv("02", proxyValue) +
        this.tlv("03", editableFlag);
      merchantAccountInfo = this.tlv("26", mai);
    } else if (config.scheme === "UPI") {
      const aid = "com.upi";
      const mai =
        this.tlv("00", aid) +
        this.tlv("01", config.payeeId.replace(/\s+/g, ""));
      merchantAccountInfo = this.tlv("26", mai);
    } else {
      throw new BadRequestException("Unsupported QR scheme");
    }

    const mcc = "0000";
    const currencyNumeric = this.getCurrencyCode(config.currency);
    const amountStr = parseFloat(config.amount).toFixed(2);
    const countryCode = config.countryCode.toUpperCase();
    const merchantName = config.payeeName.slice(0, 25);
    const merchantCity = "UNKNOWN";

    let additionalData = "";
    if (refId) {
      additionalData = this.tlv("01", refId.slice(0, 25));
    }
    const addField = additionalData ? this.tlv("62", additionalData) : "";

    const payloadWithoutCRC =
      payloadHeader +
      merchantAccountInfo +
      this.tlv("52", mcc) +
      this.tlv("53", currencyNumeric) +
      this.tlv("54", amountStr) +
      this.tlv("58", countryCode) +
      this.tlv("59", merchantName) +
      this.tlv("60", merchantCity) +
      addField +
      "6304";

    const crc = this.calculateCRC(payloadWithoutCRC);
    const fullPayload = payloadWithoutCRC + crc;
    return fullPayload;
  }

  async decodeQrFromFile(filePath: string): Promise<any> {
    try {
      const image = await Jimp.read(filePath);
      const qr = new QrCodeReader();

      const decodedText: string = await new Promise((resolve, reject) => {
        qr.callback = (err, result) => {
          if (err || !result) {
            reject(new BadRequestException("Failed to decode QR"));
          } else {
            resolve(result.result);
          }
        };
        qr.decode(image.bitmap);
      });

      if (decodedText.startsWith("upi://")) {
        const queryStr = decodedText.split("?")[1] || "";
        const params = new URLSearchParams(queryStr);
        const paramMap: Record<string, string> = {};
        params.forEach((v, k) => {
          paramMap[k] = v;
        });
        return {
          raw: decodedText,
          params: paramMap,
        };
      }

      return {
        raw: decodedText,
      };
    } catch (e) {
      throw new BadRequestException("Error decoding QR: " + e.message);
    }
  }

  // Decode QR from URL
  async decodeQrFromUrl(imageUrl: string): Promise<any> {
    if (!imageUrl) throw new BadRequestException("imageUrl missing");
    try {
      // Fetch the image bytes from the URL
      const response = await fetch(imageUrl);
      if (!response.ok)
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Load image with canvas
      const img = await loadImage(buffer);
      const canvas = createCanvas(img.width, img.height);
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, img.width, img.height);

      const imageData = ctx.getImageData(0, 0, img.width, img.height);
      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE]);
      const luminanceSource = new RGBLuminanceSource(
        imageData.data,
        img.width,
        img.height
      );
      const binaryBitmap = new BinaryBitmap(
        new HybridBinarizer(luminanceSource)
      );
      const reader = new MultiFormatReader();

      try {
        const result = reader.decode(binaryBitmap, hints);
        if (result.getText().startsWith("upi://")) {
          const params = new URLSearchParams(
            result.getText().split("?")[1] || ""
          );
          const paramMap: Record<string, string> = {};
          params.forEach((v, k) => (paramMap[k] = v));
          return { raw: result.getText(), params: paramMap };
        }
        return { raw: result.getText() };
      } catch (zxingErr) {
        throw new BadRequestException(
          "ZXing decode failed: " + zxingErr.message
        );
      }
    } catch (err) {
      throw new BadRequestException(
        "Failed to decode QR code from URL: " + err.message
      );
    }
  }

  async generateQrCode(
    config: PaymentQrConfig,
    refId?: string
  ): Promise<{ qr: string; intent: string }> {
    try {
      const payload = await this.buildPayload(config, refId);

      // Generate QR image as base64 data url
      const qr = await QRCode.toDataURL(payload, {
        errorCorrectionLevel: "M",
        margin: 2,
        scale: 6,
      });

      // Compose payment intent URI for universal deep link fallback
      let intent = `${config.scheme.toLowerCase()}://pay?pa=${encodeURIComponent(
        config.payeeId
      )}&pn=${encodeURIComponent(config.payeeName)}`;
      if (config.amount) intent += `&am=${encodeURIComponent(config.amount)}`;
      if (refId) intent += `&tr=${encodeURIComponent(refId)}`;
      if (config.currency)
        intent += `&cu=${encodeURIComponent(config.currency)}`;

      return { qr, intent };
    } catch (error) {
      console.error("Error generating QR code:", error);
      throw new BadRequestException(
        "Failed to generate QR code: " + error.message
      );
    }
  }
}
