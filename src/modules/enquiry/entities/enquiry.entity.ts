import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

export type EnquiryDocument = Enquiry & Document;

@Schema({ timestamps: true })
export class Enquiry {
  @Prop({ required: true })
  firstName: string;

  @Prop({ required: true })
  lastName: string;

  @Prop({ required: true })
  organizationName: string;

  @Prop({
    required: true,
    enum: ["events", "eshop", "both"],
    default: "events",
  })
  enquiryFor: string;

  @Prop({ required: true })
  contactNumber: string;

  @Prop({ required: true })
  emailId: string;

  @Prop({ required: true })
  message: string;

  @Prop({
    enum: ["pending", "in-review", "responded", "resolved"],
    default: "pending",
  })
  status: string;

  @Prop({ type: Date, default: Date.now })
  createdAt: Date;

  @Prop({ type: Date, default: Date.now })
  updatedAt: Date;
}

export const EnquirySchema = SchemaFactory.createForClass(Enquiry);
