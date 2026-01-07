import { PartialType } from "@nestjs/mapped-types";
import { CreateTicketDto } from "./create-ticket.dto";
import { IsEnum, IsOptional, IsBoolean, IsDateString } from "class-validator";
import { TicketStatus } from "../entities/ticket.entity";

export class UpdateTicketDto extends PartialType(CreateTicketDto) {
  @IsOptional()
  @IsEnum(TicketStatus)
  status?: TicketStatus;

  @IsOptional()
  @IsBoolean()
  isUsed?: boolean;

  @IsOptional()
  @IsDateString()
  usedAt?: string;
}
