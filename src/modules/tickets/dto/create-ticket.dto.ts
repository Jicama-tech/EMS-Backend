import {
  IsString,
  IsEmail,
  IsArray,
  IsNumber,
  IsOptional,
  IsBoolean,
  ValidateNested,
  IsDateString,
} from "class-validator";
import { Type } from "class-transformer";

export class TicketDetailDto {
  @IsString()
  type: string;

  @IsNumber()
  quantity: number;

  @IsNumber()
  price: number;
}

export class CustomerDetailsDto {
  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsEmail()
  email: string;

  @IsString()
  whatsapp: string;

  @IsOptional()
  @IsString()
  emergencyContact?: string;
}

export class EventInfoDto {
  @IsString()
  id: string;

  @IsString()
  title: string;

  @IsString()
  organizationName: string;

  @IsString()
  venue: string;

  @IsString()
  date: string;

  @IsString()
  time: string;

  @IsOptional()
  @IsString()
  image?: string;

  @IsString()
  organizerId: string;
}

export class CreateTicketDto {
  @IsString()
  ticketId: string;

  @IsString()
  eventId: string;

  @IsString()
  organizerId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TicketDetailDto)
  tickets: TicketDetailDto[];

  @ValidateNested()
  @Type(() => CustomerDetailsDto)
  customerDetails: CustomerDetailsDto;

  @IsOptional()
  @IsString()
  couponCode?: string;

  @IsOptional()
  @IsNumber()
  discount?: number;

  @IsNumber()
  total: number;

  @IsBoolean()
  paymentConfirmed: boolean;

  @IsString()
  purchaseDate: string;

  @ValidateNested()
  @Type(() => EventInfoDto)
  eventInfo: EventInfoDto;

  @IsOptional()
  @IsString()
  notes?: string;
}
