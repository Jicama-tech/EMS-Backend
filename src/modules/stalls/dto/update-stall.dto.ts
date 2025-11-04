import { PartialType } from "@nestjs/mapped-types";
import { CreateStallDto } from "./create-stall.dto";
import { IsOptional, IsString, IsDateString } from "class-validator";

export class UpdateStallDto extends PartialType(CreateStallDto) {
  @IsOptional()
  @IsString()
  qrCodePath?: string;

  @IsOptional()
  @IsDateString()
  checkInTime?: Date;

  @IsOptional()
  @IsDateString()
  checkOutTime?: Date;
}
