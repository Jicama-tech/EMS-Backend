// event.schema.ts
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export type EventDocument = Event & Document;

@Schema({ timestamps: true })
export class Event {
  @Prop({ required: true })
  title: string;

  @Prop()
  description: string;

  @Prop()
  category: string;

  @Prop()
  startDate: Date;

  @Prop()
  time: string;

  @Prop()
  endDate: Date;

  @Prop()
  endTime: string;

  @Prop({ type: Types.ObjectId, ref: "Organizer", required: true })
  organizer: Types.ObjectId;

  @Prop()
  location: string;

  @Prop()
  address: string;

  @Prop()
  ticketPrice: string;

  @Prop()
  totalTickets: number;

  @Prop({ enum: ["public", "private", "unlisted"], default: "public" })
  visibility: string;

  @Prop()
  inviteLink: string;

  @Prop([String])
  tags: string[];

  @Prop({
    type: Object,
    default: {
      food: false,
      parking: false,
      wifi: false,
      photography: false,
      security: false,
      accessibility: false,
    },
  })
  features: {
    food: boolean;
    parking: boolean;
    wifi: boolean;
    photography: boolean;
    security: boolean;
    accessibility: boolean;
  };

  @Prop()
  ageRestriction: string;

  @Prop()
  dresscode: string;

  @Prop()
  specialInstructions: string;

  @Prop()
  image: string;

  @Prop([String])
  gallery: string[];

  @Prop({
    type: Object,
    default: {},
  })
  socialMedia: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
  };

  @Prop()
  refundPolicy: string;

  @Prop()
  termsAndConditions: string;

  @Prop()
  createdAt: Date;
}

export const EventSchema = SchemaFactory.createForClass(Event);
