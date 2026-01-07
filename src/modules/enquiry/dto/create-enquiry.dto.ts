import {
  IsString,
  IsEmail,
  IsPhoneNumber,
  IsEnum,
  MinLength,
} from "class-validator";

export class CreateEnquiryDto {
  @IsString()
  @MinLength(2)
  firstName: string;

  @IsString()
  @MinLength(2)
  lastName: string;

  @IsString()
  @MinLength(2)
  organizationName: string;

  @IsEnum(["events", "eshop", "both"])
  enquiryFor: string;

  @IsPhoneNumber("IN")
  contactNumber: string;

  @IsEmail()
  emailId: string;

  @IsString()
  @MinLength(10)
  message: string;
}
