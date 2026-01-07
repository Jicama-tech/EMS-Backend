import { IsNotEmpty, IsString, IsOptional } from "class-validator";

export class ConfirmPaymentDto {
  @IsNotEmpty()
  @IsString()
  stallId: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
