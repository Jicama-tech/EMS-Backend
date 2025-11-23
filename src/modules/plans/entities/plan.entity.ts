import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

export type PlanDocument = Plan & Document;

export enum ModuleType {
  SHOPKEEPER = "Shopkeeper",
  ORGANIZER = "Organizer",
  BOTH = "Both",
}

@Schema({ timestamps: true })
export class Plan {
  @Prop({ required: true, unique: true })
  planName: string;

  @Prop({ required: true })
  price: number;

  @Prop({ required: true, type: [String] })
  features: string[]; // Array of feature descriptions

  @Prop({ required: true, enum: ModuleType })
  moduleType: ModuleType; // Shopkeeper, Organizer, or Both

  @Prop({ required: true })
  validityInDays: number; // Plan validity duration

  @Prop({ default: true })
  isActive: boolean; // To enable/disable plans

  @Prop()
  description?: string; // Optional plan description

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

export const PlanSchema = SchemaFactory.createForClass(Plan);
