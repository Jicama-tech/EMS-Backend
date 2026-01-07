import { PartialType } from "@nestjs/mapped-types";
import { CreateEnquiryDto } from "./create-enquiry.dto";
import { IsEnum, IsOptional } from "class-validator";

export class UpdateEnquiryDto extends PartialType(CreateEnquiryDto) {
  @IsOptional()
  @IsEnum(["pending", "in-review", "responded", "resolved"])
  status?: string;
}
