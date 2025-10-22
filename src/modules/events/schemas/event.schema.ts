import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export type EventDocument = Event & Document;

@Schema({ timestamps: true })
export class Event {
  @Prop({ required: true })
  title: string;

  @Prop()
  description?: string;

  @Prop()
  category?: string;

  @Prop()
  startDate: Date;

  @Prop()
  time?: string;

  @Prop()
  endDate?: Date;

  @Prop()
  endTime?: string;

  @Prop({ type: Types.ObjectId, ref: "Organizer", required: true })
  organizer: Types.ObjectId;

  @Prop()
  location?: string;

  @Prop()
  address?: string;

  @Prop()
  ticketPrice?: string;

  @Prop()
  totalTickets?: number;

  @Prop({ enum: ["public", "private", "unlisted"], default: "public" })
  visibility: string;

  @Prop()
  inviteLink?: string;

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
  ageRestriction?: string;

  @Prop()
  dresscode?: string;

  @Prop()
  specialInstructions?: string;

  @Prop()
  refundPolicy?: string;

  @Prop()
  termsAndConditions?: string;

  @Prop()
  setupTime?: string;

  @Prop()
  breakdownTime?: string;

  // Media fields
  @Prop()
  image?: string;

  @Prop([String])
  gallery?: string[];

  @Prop({
    type: Object,
    default: {
      facebook: "",
      instagram: "",
      twitter: "",
      linkedin: "",
    },
  })
  socialMedia?: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
    linkedin?: string;
  };

  // Exhibition/Venue fields
  @Prop({ type: Array, default: [] })
  tableTemplates: any[];

  @Prop({ type: Array, default: [] })
  venueTables: any[];

  @Prop({ type: Array, default: [] })
  addOnItems: any[];

  @Prop({
    type: Object,
    default: {
      width: 800,
      height: 500,
      scale: 0.75,
      gridSize: 20,
      showGrid: true,
      hasMainStage: true,
    },
  })
  venueConfig: {
    width: number;
    height: number;
    scale: number;
    gridSize: number;
    showGrid: boolean;
    hasMainStage: boolean;
  };

  @Prop({ enum: ["draft", "published", "cancelled"], default: "draft" })
  status: string;

  @Prop({ default: false })
  featured: boolean;

  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;
}

export const EventSchema = SchemaFactory.createForClass(Event);
