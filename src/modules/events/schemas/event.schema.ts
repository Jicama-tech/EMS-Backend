import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export type EventDocument = Event & Document;

class VenueConfig {
  @Prop()
  venueConfigId: string;

  @Prop()
  width: number;

  @Prop()
  height: number;

  @Prop()
  scale: number;

  @Prop()
  gridSize: number;

  @Prop()
  showGrid: boolean;

  @Prop()
  hasMainStage: boolean;

  @Prop()
  totalRows: number;
}

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

  // Exhibition/Venue fields with ROW-BASED PRICING
  @Prop({ type: Array, default: [] })
  tableTemplates: {
    id: string;
    name: string;
    type: "Straight" | "Corner" | "Round" | "Square";
    width: number;
    height: number;
    rowNumber: number; // NEW: Row number for pricing
    tablePrice: number; // NEW: Full table rental price
    bookingPrice: number; // NEW: Partial payment (must be <= tablePrice)
    depositPrice: number; // NEW: Security deposit (can be > tablePrice)
    isBooked: boolean; // NEW: Booking status
    bookedBy?: string; // NEW: Reference to shopkeeper/stall booking
    customDimensions?: boolean;
  }[];

  @Prop({ type: Array, default: [] })
  venueTables: {
    venueConfigId: string;
    positionId: string;
    id: string;
    name: string;
    type: "Straight" | "Corner" | "Round" | "Square";
    width: number;
    height: number;
    x: number;
    y: number;
    rotation: number;
    isPlaced: boolean;
    rowNumber: number; // NEW: Row number for pricing
    tablePrice: number; // NEW: Full table rental price
    bookingPrice: number; // NEW: Partial payment (must be <= tablePrice)
    depositPrice: number; // NEW: Security deposit (can be > tablePrice)
    isBooked: boolean; // NEW: Booking status
    bookedBy?: string; // NEW: Reference to shopkeeper/stall booking
  }[];

  @Prop({ type: Array, default: [] })
  addOnItems: {
    id: string;
    name: string;
    price: number;
    description: string;
  }[];

  @Prop({
    type: [Object],
    default: [
      {
        venueConfigId: "venueConfig1",
        width: 800,
        height: 500,
        scale: 0.75,
        gridSize: 20,
        showGrid: true,
        hasMainStage: true,
        totalRows: 3,
      },
    ],
  })
  venueConfig: VenueConfig[];

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
