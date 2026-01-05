import {
  IsString,
  IsNotEmpty,
  MinLength,
  IsOptional,
  IsEmail,
  IsBoolean,
  IsEnum,
} from "class-validator";

export class CreateShopkeeperDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  shopName: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsString()
  @IsNotEmpty()
  address: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsNotEmpty()
  whatsappNumber: string;

  @IsEmail() // ← CHANGED: Email validation
  @IsNotEmpty() // ← CHANGED: Required (matches schema)
  businessEmail: string;

  @IsString()
  @IsNotEmpty()
  businessCategory: string;

  @IsString()
  @IsOptional()
  GSTNumber: string;

  // ← NEW FIELDS (Singapore/Country support)
  @IsString()
  @IsOptional()
  UENNumber?: string;

  @IsString()
  @IsNotEmpty()
  country: string;

  @IsBoolean()
  @IsNotEmpty()
  hasDocVerification: boolean;
}
