import { PartialType } from "@nestjs/mapped-types";
import { IsEmail, IsOptional, IsString, IsBoolean } from "class-validator";

export class UpdateOrganizerDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  organizationName?: string;

  @IsOptional()
  @IsEmail()
  businessEmail?: string;

  @IsOptional()
  @IsString()
  whatsAppNumber?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  paymentURL?: string;

  @IsOptional()
  @IsString()
  phoneNumber: string;

  @IsOptional()
  @IsString()
  bio?: string;
}
