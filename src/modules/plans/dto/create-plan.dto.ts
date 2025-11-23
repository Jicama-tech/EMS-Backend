import {
  IsString,
  IsNumber,
  IsEnum,
  IsArray,
  IsBoolean,
  IsOptional,
  Min,
} from "class-validator";
import { ModuleType } from "../entities/plan.entity";

export class CreatePlanDto {
  @IsString()
  planName: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsArray()
  @IsString({ each: true })
  features: string[];

  @IsEnum(ModuleType)
  moduleType: ModuleType;

  @IsNumber()
  @Min(1)
  validityInDays: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  description?: string;
}
