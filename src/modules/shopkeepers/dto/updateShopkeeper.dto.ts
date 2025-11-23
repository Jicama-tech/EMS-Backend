import {
  IsEmail,
  IsString,
  MinLength,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsDate,
} from "class-validator";

export class UpdateShopkeeperDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  shopName?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  // Keep password optional for updates; only validate strength if provided
  @IsString()
  @MinLength(8)
  @IsOptional()
  password?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEmail()
  @IsOptional()
  businessEmail?: string;

  @IsString()
  @IsOptional()
  whatsappNumber?: string;

  @IsString()
  @IsOptional()
  businessCategory?: string;

  @IsNumber()
  @IsOptional()
  followers?: number;

  // If you still keep a textual payment URL (e.g., UPI link)
  @IsString()
  @IsOptional()
  paymentURL?: string;

  // If you store the public URL of the uploaded QR image on the profile
  @IsString()
  @IsOptional()
  paymentQrUrl?: string;

  @IsDate()
  @IsOptional()
  shopClosedFromDate?: Date;

  @IsDate()
  @IsOptional()
  shopClosedToDate?: Date;
}
