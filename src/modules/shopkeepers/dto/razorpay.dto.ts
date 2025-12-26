import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEmail,
  IsBoolean,
} from "class-validator";

// ✅ NEW: Razorpay Setup DTO (separate from main profile)
export class CreateRazorpayLinkedAccountDto {
  @IsString()
  @IsNotEmpty()
  businessName: string;

  @IsString()
  @IsNotEmpty()
  businessType: "proprietorship" | "partnership" | "private_limited" | "llp";

  @IsEmail()
  @IsNotEmpty()
  businessEmail: string;

  @IsString()
  @IsNotEmpty()
  businessPhone: string;

  // KYC
  @IsString()
  @IsNotEmpty()
  panNumber: string;

  @IsString()
  @IsOptional()
  gstNumber?: string;

  @IsString()
  @IsOptional()
  uenNumber?: string;

  // Bank Details
  @IsString()
  @IsNotEmpty()
  accountHolderName: string;

  @IsString()
  @IsNotEmpty()
  bankName: string;

  @IsString()
  @IsNotEmpty()
  bankAccountNumber: string;

  @IsString()
  @IsNotEmpty()
  ifscCode: string;

  // Address
  @IsString()
  @IsNotEmpty()
  address: string;

  @IsString()
  @IsNotEmpty()
  city: string;

  @IsString()
  @IsNotEmpty()
  state: string;

  @IsString()
  @IsNotEmpty()
  zipcode: string;

  @IsString()
  @IsNotEmpty()
  country: "IN" | "SG";

  // Consent
  @IsBoolean()
  @IsNotEmpty()
  consent: boolean;
}

// ✅ EXISTING: Create Shopkeeper DTO (unchanged)
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

  @IsEmail()
  @IsNotEmpty()
  businessEmail: string;

  @IsString()
  @IsNotEmpty()
  businessCategory: string;

  @IsString()
  @IsNotEmpty()
  GSTNumber: string;

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
