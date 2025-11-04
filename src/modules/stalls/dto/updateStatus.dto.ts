import { IsEnum, IsOptional, IsString } from "class-validator";

/**
 * DTO for updating stall request status
 * Used by organizer to confirm or cancel requests
 */
export class UpdateStatusDto {
  @IsEnum(["Pending", "Confirmed", "Cancelled", "Processing", "Completed"])
  status: "Pending" | "Confirmed" | "Cancelled" | "Processing" | "Completed";

  @IsOptional()
  @IsString()
  cancellationReason?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
