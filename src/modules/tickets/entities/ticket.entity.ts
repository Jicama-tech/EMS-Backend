import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export type TicketDocument = Ticket & Document;

export enum TicketStatus {
  PENDING = "pending",
  CONFIRMED = "confirmed",
  CANCELLED = "cancelled",
  USED = "used",
}

@Schema({ timestamps: true })
export class Ticket {
  @Prop({ required: true, unique: true })
  ticketId: string;

  @Prop({ type: Types.ObjectId, ref: "Event", required: true })
  eventId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: "Organizer", required: true })
  organizerId: Types.ObjectId;

  @Prop({ required: true })
  eventTitle: string;

  @Prop({ required: true })
  eventDate: Date;

  @Prop({ required: true })
  eventTime: string;

  @Prop({ required: true })
  eventVenue: string;

  @Prop()
  customerName: string;

  @Prop()
  customerEmail: string;

  @Prop()
  customerWhatsapp: string;

  @Prop()
  customerEmergencyContact?: string;

  @Prop({
    type: [
      {
        ticketType: { type: String, required: true },
        quantity: { type: Number, required: true },
        price: { type: Number, required: true },
      },
    ],
    required: true,
  })
  ticketDetails: Array<{
    ticketType: string;
    quantity: number;
    price: number;
  }>;

  @Prop({ required: true })
  totalAmount: number;

  @Prop({ required: true })
  paymentConfirmed: boolean;

  @Prop({ enum: TicketStatus, default: TicketStatus.PENDING })
  status: TicketStatus;

  @Prop({ type: Date, required: true })
  purchaseDate: Date;

  @Prop({ default: false })
  isUsed: boolean;

  @Prop()
  usedAt?: Date;

  @Prop()
  notes?: string;

  @Prop({ default: false })
  attendance?: boolean;

  @Prop()
  qrCode?: string;

  @Prop()
  pdfPath?: string;
}

export const TicketSchema = SchemaFactory.createForClass(Ticket);
