import {
  IsString,
  IsMongoId,
  IsArray,
  IsNumber,
  IsEnum,
  IsOptional,
  ValidateNested,
  IsDateString,
  IsObject,
} from "class-validator";
import { Type } from "class-transformer";

export enum OrderStatus {
  Pending = "pending",
  Processing = "processing",
  Ready = "ready",
  Shipped = "shipped",
  Cancelled = "cancelled",
  Completed = "completed",
}

export enum OrderType {
  Delivery = "delivery",
  Pickup = "pickup",
}

class AddressDto {
  @IsString()
  street: string;

  @IsString()
  city: string;

  @IsString()
  state: string;

  zip: string;

  @IsOptional()
  @IsString()
  instructions?: string;
}

class OrderItemDto {
  @IsString()
  productId: string;

  @IsString()
  productName: string;

  @IsNumber()
  @IsOptional()
  price?: number;

  @IsNumber()
  quantity: number;

  @IsOptional()
  @IsString()
  variantTitle?: string;

  @IsOptional()
  @IsString()
  subcategoryName?: string;

  @IsOptional()
  @IsString()
  image?: string;
}

export class CreateOrderDto {
  @IsString()
  orderId: string;

  @IsOptional()
  @IsMongoId()
  userId?: string; // now optional, will be filled automatically when found or created

  @IsMongoId()
  shopkeeperId: string;

  @IsArray()
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  @IsNumber()
  totalAmount: number;

  @IsEnum(OrderType)
  orderType: OrderType;

  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  deliveryAddress?: AddressDto;

  @IsOptional()
  @IsDateString()
  pickupDate?: string;

  @IsOptional()
  @IsString()
  pickupTime?: string;

  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  // new field for WhatsApp-based identity
  @IsString()
  whatsAppNumber: string;

  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;
}
