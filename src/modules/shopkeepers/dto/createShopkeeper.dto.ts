import {
  IsEmail,
  IsString,
  MinLength,
  IsNotEmpty,
  IsObject,
  ValidateNested,
  IsBoolean,
  IsOptional,
  IsNumber,
} from "class-validator";
import { Type } from "class-transformer";

class BusinessHourDto {
  @IsString()
  @IsOptional()
  open?: string;

  @IsString()
  @IsOptional()
  close?: string;

  @IsBoolean()
  @IsOptional()
  closed?: boolean;
}

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
  @MinLength(8)
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

  @IsEmail()
  @IsNotEmpty()
  businessEmail: string;

  @IsString()
  @IsNotEmpty()
  whatsappNumber: string;

  @IsString()
  @IsNotEmpty()
  businessCategory: string;

  @IsNumber()
  @IsOptional()
  followers?: number;

  @IsOptional()
  taxPercentage?: number;

  @IsOptional()
  @IsString()
  paymentURL: string;
}
