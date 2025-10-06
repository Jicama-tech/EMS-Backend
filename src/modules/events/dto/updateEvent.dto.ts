// updateEvent.dto.ts
import { PartialType } from "@nestjs/mapped-types";
import {
  IsString,
  IsDateString,
  IsOptional,
  IsArray,
  IsObject,
  IsUrl,
  IsBoolean,
  IsEnum,
} from "class-validator";
import { Type } from "class-transformer";
import {
  CreateEventDto,
  Visibility,
  OrganizerDto,
  SocialMediaDto,
  FeaturesDto,
} from "./createEvent.dto";

export class UpdateEventDto extends PartialType(CreateEventDto) {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsString()
  @IsOptional()
  location?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  images?: string[];

  @IsString()
  @IsOptional()
  category?: string;

  @IsString()
  @IsOptional()
  time?: string;

  @IsString()
  @IsOptional()
  endTime?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  ticketPrice?: string;

  @IsString()
  @IsOptional()
  totalTickets?: string;

  @IsEnum(Visibility)
  @IsOptional()
  visibility?: Visibility;

  @IsString()
  @IsOptional()
  inviteLink?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @IsObject()
  @IsOptional()
  features?: FeaturesDto;

  @IsString()
  @IsOptional()
  ageRestriction?: string;

  @IsString()
  @IsOptional()
  dresscode?: string;

  @IsString()
  @IsOptional()
  specialInstructions?: string;

  @IsString()
  @IsOptional()
  refundPolicy?: string;

  @IsString()
  @IsOptional()
  termsAndConditions?: string;

  @IsObject()
  @Type(() => OrganizerDto)
  @IsOptional()
  organizer?: OrganizerDto;

  @IsObject()
  @Type(() => SocialMediaDto)
  @IsOptional()
  socialMedia?: SocialMediaDto;

  @IsString()
  @IsOptional()
  image?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  gallery?: string[];
}
