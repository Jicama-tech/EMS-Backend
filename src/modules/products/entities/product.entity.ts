import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

export type ProductDocument = Product & Document;

class Variant {
  @Prop({ required: true })
  id: number;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  price: number;

  @Prop()
  compareAtPrice?: number;

  @Prop({ required: true })
  sku: string;

  @Prop()
  barcode?: string;

  @Prop({ default: 0 })
  inventory: number;

  @Prop({ default: 10 })
  lowstockThreshold: number;

  @Prop({ default: true })
  trackQuantity: boolean;

  @Prop({ type: Object, default: {} })
  options: Record<string, any>;
}

class Subcategory {
  @Prop({ required: true })
  id: number;

  @Prop({ required: true })
  name: string;

  @Prop()
  description?: string;

  @Prop({ default: 0 })
  basePrice: number;

  @Prop({ type: [Variant], default: [] })
  variants: Variant[];
}

@Schema({ timestamps: true })
export class Product {
  @Prop({ required: true })
  name: string;

  @Prop()
  description?: string;

  @Prop({ required: true })
  price: number;

  @Prop({ required: true })
  sku: string;

  @Prop()
  barcode?: string;

  @Prop({ required: true })
  category: string;

  @Prop({ enum: ["active", "draft", "archived"], default: "active" })
  status: string;

  @Prop({
    type: [String],
    default: [],
    validate: [arrayLimit, "Maximum 3 images allowed"],
  })
  images: string[];

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop({ type: [Subcategory], default: [] })
  subcategories: Subcategory[];

  @Prop()
  weight?: number;

  @Prop({ type: Object })
  dimensions?: {
    length: number;
    width: number;
    height: number;
  };

  // Product-level inventory management (when no subcategories/variants)
  @Prop({ default: 0 })
  inventory?: number;

  @Prop({ default: 10 })
  lowstockThreshold?: number;

  @Prop({ default: true })
  trackQuantity?: boolean;

  @Prop({ required: true })
  shopkeeperId: string;
}

function arrayLimit(val: string[]) {
  return val.length <= 3;
}

export const ProductSchema = SchemaFactory.createForClass(Product);
