import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";

import { Document } from "mongoose";

export type ShopkeeperDocument = Shopkeeper & Document;

// ✅ NEW: Razorpay linked account sub-schema
export class RazorpayLinkedAccount {
  @Prop()
  accountId: string; // acc_xxxxx from Razorpay

  @Prop({
    type: String,
    enum: ["pending_kyc", "active", "rejected", "suspended"],
    default: "pending_kyc",
  })
  status: string;

  @Prop()
  kycStatus?: string;

  @Prop()
  businessName: string;

  @Prop()
  panNumber: string;

  @Prop()
  gstNumber?: string;

  @Prop()
  uenNumber?: string;

  @Prop()
  bankAccountNumber: string;

  @Prop()
  bankIfscCode: string;

  @Prop()
  bankName: string;

  @Prop()
  accountHolderName: string;

  @Prop()
  businessEmail: string;

  @Prop()
  businessPhone: string;

  @Prop()
  verifiedAt?: Date;

  @Prop({ default: Date.now })
  createdAt: Date;

  @Prop({ default: Date.now })
  updatedAt: Date;
}

@Schema({ timestamps: true })
export class Shopkeeper {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  shopName: string;

  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true })
  businessEmail: string;

  @Prop({ required: true })
  phone: string;

  @Prop({ required: true })
  address: string;

  @Prop()
  description: string;

  @Prop({ type: Object })
  businessHours: Record<
    string,
    { open: string; close: string; closed: boolean }
  >;

  @Prop({ required: true })
  whatsappNumber: string;

  @Prop()
  GSTNumber?: string;

  @Prop()
  UENNumber: string;

  @Prop()
  country: string;

  @Prop({ default: false })
  hasDocVerification: boolean;

  @Prop()
  shopClosedFromDate?: Date;

  @Prop()
  shopClosedToDate?: Date;

  @Prop({ default: 0 })
  taxPercentage: number;

  @Prop({ default: false })
  approved: boolean;

  @Prop()
  paymentURL: string;

  @Prop({ default: false })
  rejected: boolean;

  @Prop({ required: true })
  businessCategory: string;

  @Prop({ default: 0 })
  followers: number;

  @Prop()
  updatedAt?: Date;

  @Prop()
  createdAt: Date;

  // ✅ NEW: Razorpay linked account integration
  @Prop({ type: RazorpayLinkedAccount, default: null })
  razorpay?: RazorpayLinkedAccount;

  // ✅ NEW: Commission percentage (EventSH takes this %)
  @Prop({ default: 2 })
  commissionPercentage: number;
}

export const RazorpayLinkedAccountSchema = SchemaFactory.createForClass(
  RazorpayLinkedAccount
);

export const ShopkeeperSchema = SchemaFactory.createForClass(Shopkeeper);
