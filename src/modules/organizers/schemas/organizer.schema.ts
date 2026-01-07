import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export type OrganizerDocument = Organizer & Document;

@Schema({ timestamps: true })
export class Organizer {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true })
  organizationName: string;

  @Prop({ required: false })
  phone: string;

  @Prop({ required: true, unique: true })
  businessEmail: string; // New field from frontend

  @Prop({ required: true, unique: true })
  whatsAppNumber: string; // New field from frontend

  @Prop()
  address: string;

  @Prop()
  slug: string;

  @Prop()
  phoneNumber: string;

  @Prop()
  paymentURL: string;

  @Prop()
  bio: string;

  @Prop({ default: false })
  approved: boolean;

  @Prop({ default: false })
  rejected: boolean;

  @Prop()
  updatedAt?: Date;

  @Prop()
  createdAt: Date;

  @Prop({ default: false })
  subscribed?: boolean;

  @Prop()
  planStartDate?: Date;

  @Prop()
  planExpiryDate?: Date;

  @Prop()
  pricePaid?: string;

  @Prop({ type: Types.ObjectId, ref: "Plan", required: false })
  planId?: Types.ObjectId | null;
}

export const OrganizerSchema = SchemaFactory.createForClass(Organizer);
