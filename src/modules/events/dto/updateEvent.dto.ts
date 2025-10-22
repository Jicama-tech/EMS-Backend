import { PartialType } from "@nestjs/mapped-types";
import { CreateEventDto } from "./createEvent.dto";
import { IsOptional, IsString } from "class-validator";

export class UpdateEventDto extends PartialType(CreateEventDto) {
  @IsString()
  @IsOptional()
  organizerId?: string;

  @IsOptional()
  organizer?: any;
}
