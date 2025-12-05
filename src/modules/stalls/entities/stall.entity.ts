import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export type StallDocument = Stall & Document;

// Sub-schema for selected tables
class SelectedTable {
  @Prop({ required: true })
  tableId: string;

  @Prop({ required: true })
  positionId: string;

  @Prop({ required: true })
  tableName: string;

  @Prop({ required: true })
  tableType: string;

  @Prop()
  layoutName: string;

  @Prop({ required: true })
  price: number;

  @Prop({ required: true })
  depositAmount: number;
}

// Sub-schema for selected add-ons
class SelectedAddOn {
  @Prop({ required: true })
  addOnId: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  price: number;

  @Prop({ default: 1 })
  quantity: number;
}

@Schema({ timestamps: true })
export class Stall {
  @Prop({ type: Types.ObjectId, ref: "Shopkeeper", required: true })
  shopkeeperId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: "Event", required: true })
  eventId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: "Organizer", required: true })
  organizerId: Types.ObjectId;

  // Request Status - Workflow status
  @Prop({
    enum: ["Pending", "Confirmed", "Cancelled", "Processing", "Completed"],
    default: "Pending",
  })
  status: string;

  // Payment Status - Separate from booking status
  @Prop({
    enum: ["Unpaid", "Partial", "Paid"],
    default: "Unpaid",
  })
  paymentStatus: string;

  // Table Selection - Array of selected tables
  @Prop({ type: [SelectedTable], default: [] })
  selectedTables: SelectedTable[];

  // Add-on Selection - Array of selected add-ons
  @Prop({ type: [SelectedAddOn], default: [] })
  selectedAddOns: SelectedAddOn[];

  // Pricing Breakdown
  @Prop({ default: 0 })
  tablesTotal: number;

  @Prop({ default: 0 })
  depositTotal: number;

  @Prop({ default: 0 })
  addOnsTotal: number;

  @Prop({ default: 0 })
  grandTotal: number;

  @Prop({ default: 0 })
  paidAmount: number;

  @Prop({ default: 0 })
  remainingAmount: number;

  // QR Code Fields - NEW
  @Prop({ default: null })
  qrCodePath: string; // Path to saved QR code image

  @Prop({ default: null })
  qrCodeData: string; // Encrypted QR data string

  // Attendance Tracking Fields - NEW
  @Prop({ default: null })
  checkInTime: Date; // First scan time

  @Prop({ default: null })
  checkOutTime: Date; // Second scan time

  @Prop({ default: false })
  hasCheckedIn: boolean;

  @Prop({ default: false })
  hasCheckedOut: boolean;

  // Timestamps for workflow tracking
  @Prop({ default: Date.now })
  requestDate: Date;

  @Prop()
  confirmationDate?: Date;

  @Prop()
  selectionDate?: Date;

  @Prop()
  paymentDate?: Date;

  @Prop()
  paymentConfirmedDate?: Date; // When organizer confirms payment - NEW

  @Prop()
  completionDate?: Date;

  @Prop()
  depositReturned?: boolean;

  @Prop()
  depositReturnedDate?: Date;

  // Additional Information
  @Prop()
  notes?: string;

  @Prop()
  cancellationReason?: string;

  // Auto-managed timestamps
  @Prop({ default: Date.now })
  createdAt: Date;

  @Prop({ default: Date.now })
  updatedAt: Date;
}

export const StallSchema = SchemaFactory.createForClass(Stall);

// Add indexes for common queries
StallSchema.index({ eventId: 1, shopkeeperId: 1 });
StallSchema.index({ organizerId: 1, eventId: 1 });
StallSchema.index({ status: 1 });
StallSchema.index({ paymentStatus: 1 });
StallSchema.index({ shopkeeperId: 1 });
StallSchema.index({ organizerId: 1 });
StallSchema.index({ eventId: 1, status: 1 });
StallSchema.index({ qrCodeData: 1 }); // NEW - for QR scanning
