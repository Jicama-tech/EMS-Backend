import { IsEnum, IsOptional, IsString, IsBoolean } from "class-validator";

/**
 * DTO for updating payment status (Phase 3)
 */
export class UpdatePaymentStatusDto {
  @IsEnum(["Unpaid", "Partial", "Paid"])
  paymentStatus: "Unpaid" | "Partial" | "Paid";

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsBoolean()
  generateQr?: boolean; // New field to trigger QR generation on 'Paid' status
}
