import {
  IsString,
  IsDateString,
  IsOptional,
  IsArray,
  IsUrl,
  IsBoolean,
  IsEnum,
  ValidateNested,
  IsNumber,
  Min,
} from "class-validator";
import { Type } from "class-transformer";

export enum Visibility {
  PUBLIC = "public",
  PRIVATE = "private",
  UNLISTED = "unlisted",
}

export enum EventStatus {
  DRAFT = "draft",
  PUBLISHED = "published",
  CANCELLED = "cancelled",
}

export class SocialMediaDto {
  @IsUrl()
  @IsOptional()
  facebook?: string;

  @IsUrl()
  @IsOptional()
  instagram?: string;

  @IsUrl()
  @IsOptional()
  twitter?: string;

  @IsUrl()
  @IsOptional()
  linkedin?: string;
}

export class FeaturesDto {
  @IsBoolean()
  @IsOptional()
  food?: boolean;

  @IsBoolean()
  @IsOptional()
  parking?: boolean;

  @IsBoolean()
  @IsOptional()
  wifi?: boolean;

  @IsBoolean()
  @IsOptional()
  photography?: boolean;

  @IsBoolean()
  @IsOptional()
  security?: boolean;

  @IsBoolean()
  @IsOptional()
  accessibility?: boolean;
}

// Table templates (row-based pricing)
export class TableTemplateDto {
  @IsString()
  id: string;

  @IsString()
  name: string;

  @IsString()
  type: "Straight" | "Corner" | "Round" | "Square";

  @IsNumber()
  width: number;

  @IsNumber()
  height: number;

  @IsNumber()
  @Min(1)
  rowNumber: number;

  @IsNumber()
  @Min(0)
  tablePrice: number;

  @IsNumber()
  @Min(0)
  bookingPrice: number;

  @IsNumber()
  @Min(0)
  depositPrice: number;

  @IsBoolean()
  @IsOptional()
  isBooked?: boolean;

  @IsString()
  @IsOptional()
  bookedBy?: string;

  @IsBoolean()
  @IsOptional()
  customDimensions?: boolean;
}

// Positioned tables (extends template)
export class PositionedTableDto extends TableTemplateDto {
  @IsString()
  positionId: string;

  @IsNumber()
  x: number;

  @IsNumber()
  y: number;

  @IsNumber()
  rotation: number;

  @IsBoolean()
  isPlaced: boolean;

  @IsString()
  venueConfigId: string;
}

// Add-on items
export class AddOnItemDto {
  @IsString()
  id: string;

  @IsString()
  name: string;

  @IsNumber()
  price: number;

  @IsString()
  @IsOptional()
  description?: string;
}

// Venue configs (now array, includes venueConfigId)
export class VenueConfigDto {
  @IsString()
  venueConfigId: string;

  @IsNumber()
  width: number;

  @IsNumber()
  height: number;

  @IsNumber()
  scale: number;

  @IsNumber()
  gridSize: number;

  @IsBoolean()
  showGrid: boolean;

  @IsBoolean()
  hasMainStage: boolean;

  @IsNumber()
  @Min(1)
  @IsOptional()
  totalRows?: number;
}

export class CreateEventDto {
  @IsString()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsDateString()
  startDate: string;

  @IsString()
  @IsOptional()
  time?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsString()
  @IsOptional()
  endTime?: string;

  @IsString()
  organizerId: string;

  @IsString()
  @IsOptional()
  location?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  ticketPrice?: string;

  @IsNumber()
  @IsOptional()
  totalTickets?: number;

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

  @ValidateNested()
  @IsOptional()
  @Type(() => FeaturesDto)
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

  @IsString()
  @IsOptional()
  setupTime?: string;

  @IsString()
  @IsOptional()
  breakdownTime?: string;

  @ValidateNested()
  @IsOptional()
  @Type(() => SocialMediaDto)
  socialMedia?: SocialMediaDto;

  @IsString()
  @IsOptional()
  image?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  gallery?: string[];

  @ValidateNested({ each: true })
  @IsOptional()
  @Type(() => TableTemplateDto)
  tableTemplates?: TableTemplateDto[];

  @ValidateNested({ each: true })
  @IsOptional()
  @Type(() => PositionedTableDto)
  venueTables?: PositionedTableDto[];

  @ValidateNested({ each: true })
  @IsOptional()
  @Type(() => AddOnItemDto)
  addOnItems?: AddOnItemDto[];

  // CHANGED: now array to match schema
  @ValidateNested({ each: true })
  @IsOptional()
  @Type(() => VenueConfigDto)
  venueConfig?: VenueConfigDto[];

  @IsEnum(EventStatus)
  @IsOptional()
  status?: EventStatus;

  @IsBoolean()
  @IsOptional()
  featured?: boolean;
}
