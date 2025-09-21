import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

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
  bio: string;

  @Prop({ default: false })
  approved: boolean;

  @Prop({ default: false })
  rejected: boolean;

  @Prop()
  updatedAt?: Date;

  @Prop()
  createdAt: Date;
}

export const OrganizerSchema = SchemaFactory.createForClass(Organizer);
