import {
  IsArray,
  IsString,
  IsNumber,
  IsOptional,
  ValidateNested,
  Min,
} from "class-validator";
import { Type } from "class-transformer";

/**
 * DTO for a single selected table
 */
export class SelectedTableDto {
  @IsString()
  tableId: string;

  @IsString()
  positionId: string;

  @IsString()
  tableName: string;

  @IsString()
  tableType: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsNumber()
  @Min(0)
  depositAmount: number;
}

/**
 * DTO for a single selected add-on
 */
export class SelectedAddOnDto {
  @IsString()
  addOnId: string;

  @IsString()
  name: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsNumber()
  @Min(1)
  quantity: number;
}

/**
 * DTO for selecting tables and add-ons (Phase 2)
 * This is used when shopkeeper selects tables and add-ons after organizer confirms
 */
export class SelectTablesAndAddOnsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SelectedTableDto)
  selectedTables: SelectedTableDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SelectedAddOnDto)
  selectedAddOns?: SelectedAddOnDto[];

  @IsOptional()
  @IsString()
  notes?: string;
}
