import { PartialType } from "@nestjs/mapped-types";
import { CreateOrderDto, OrderStatus } from "./create-order.dto";
import { IsEnum } from "class-validator";

export class UpdateOrderDto {
  @IsEnum(OrderStatus)
  status: OrderStatus;
}
