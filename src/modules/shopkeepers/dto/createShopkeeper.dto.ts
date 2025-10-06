import {
  IsString,
  IsNotEmpty,
  MinLength,
  IsOptional,
  IsEmail,
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
  @MinLength(8)
  @IsNotEmpty()
  password: string;

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
  whatsappNumber: string; // <-- MAKE REQUIRED

  @IsString()
  @IsOptional()
  businessEmail?: string; // <-- MAKE OPTIONAL

  @IsString()
  @IsNotEmpty()
  businessCategory: string;
}
