// src/users/dto/create-user.dto.ts
import { IsString, IsNotEmpty, IsOptional, IsEmail } from "class-validator";

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  password?: string;

  @IsString()
  @IsOptional()
  provider?: string; // e.g., 'google', 'instagram'

  @IsString()
  @IsOptional()
  providerId?: string; // Unique ID from the social provider

  @IsString()
  @IsOptional()
  whatsAppNumber?: string;

  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;
}
