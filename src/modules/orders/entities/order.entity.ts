import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export enum OrderStatus {
  Pending = "pending",
  Processing = "processing", // For delivery orders after payment confirmation
  Ready = "ready", // For pickup orders when ready
  Shipped = "shipped", // When delivery is out for shipping
  Cancelled = "cancelled", // When rejected or cancelled
  Completed = "completed",
}

// Additional enum for order type
export enum OrderType {
  Delivery = "delivery",
  Pickup = "pickup",
}

@Schema({ timestamps: true })
export class Order extends Document {
  @Prop({ required: true, unique: true })
  orderId: string;

  @Prop({ required: true, type: Types.ObjectId, ref: "User" })
  userId: string;

  @Prop({ required: true, type: Types.ObjectId, ref: "Shopkeeper" })
  shopkeeperId: Types.ObjectId;

  @Prop({ type: Array, required: true })
  items: any[]; // Ideally, create a subdocument schema for items

  @Prop({ required: true })
  totalAmount: number;

  @Prop({ type: String, enum: OrderType, required: true })
  orderType: OrderType;

  @Prop({ type: String, enum: OrderStatus, default: OrderStatus.Pending })
  status: OrderStatus;

  @Prop({ type: Object, required: false })
  deliveryAddress?: {
    street: string;
    city: string;
    state: string;
    zip: string;
    instructions?: string;
  };

  @Prop({ type: Date, required: false })
  pickupDate?: Date;

  @Prop({ type: String, required: false }) // Store time in "HH:mm" or ISO string as per your logic
  pickupTime?: string;

  @Prop({ default: Date.now })
  createdAt: Date;

  @Prop({ default: Date.now })
  updatedAt: Date;
}

export const OrderSchema = SchemaFactory.createForClass(Order);
