import { IsString, IsOptional, IsMongoId, IsEmail } from "class-validator";
import { Types } from "mongoose";

/**
 * DTO for creating initial stall request (Phase 1)
 * This is used when shopkeeper first requests a stall
 * Only basic information is needed at this stage
 */
export class CreateStallDto {
  @IsMongoId()
  eventId: Types.ObjectId;

  @IsMongoId()
  organizerId: Types.ObjectId;

  // Shopkeeper Info - if exists, use ID; if not, create new
  @IsOptional()
  @IsMongoId()
  shopkeeperId?: Types.ObjectId;

  // Shopkeeper details (if creating new shopkeeper)
  @IsOptional()
  @IsString()
  shopkeeperName?: string;

  @IsOptional()
  @IsEmail()
  shopkeeperEmail?: string;

  @IsOptional()
  @IsString()
  shopkeeperWhatsAppNumber?: string;

  @IsOptional()
  @IsString()
  shopkeeperCountryCode?: string;

  @IsOptional()
  @IsString()
  shopkeeperPhoneNumber?: string;

  @IsOptional()
  @IsString()
  businessName?: string;

  @IsOptional()
  @IsString()
  businessType?: string;

  @IsOptional()
  @IsString()
  businessDescription?: string;

  @IsOptional()
  @IsString()
  businessAddress?: string;

  @IsOptional()
  @IsString()
  businessCity?: string;

  @IsOptional()
  @IsString()
  businessState?: string;

  @IsOptional()
  @IsString()
  businessPincode?: string;

  // Additional Info
  @IsOptional()
  @IsString()
  notes?: string;
}
