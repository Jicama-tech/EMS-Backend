import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

export type OtpChannel = "business_email" | "whatsapp";

@Schema({ timestamps: true })
export class Otp extends Document {
  // For backward compatibility with existing code:
  @Prop()
  email?: string;

  @Prop({ required: true })
  role: "organizer" | "shopkeeper"; // or broader string union

  @Prop({ required: true })
  otp: string;

  @Prop({ required: true })
  expiresAt: Date;

  @Prop({ default: 0 })
  attempts: number;

  @Prop({ default: false })
  verified: boolean;

  // NEW: OTP channel and normalized identifier (email or digits-only whatsapp)
  @Prop({ required: true, enum: ["business_email", "whatsapp"] })
  channel: OtpChannel;

  @Prop({ required: true, index: true })
  identifier: string; // email string or digits-only phone

  // Rate limiting support
  @Prop({ default: null })
  lastSentAt: Date | null;
}

export const OtpSchema = SchemaFactory.createForClass(Otp);

// TTL index
OtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Optional unique compound index to avoid duplicates
OtpSchema.index({ channel: 1, role: 1, identifier: 1 }, { unique: true });
