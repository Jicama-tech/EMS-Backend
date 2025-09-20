import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Patch,
  Query,
  BadRequestException,
  InternalServerErrorException,
  Delete,
} from "@nestjs/common";
import { OrdersService } from "./orders.service";
import { CreateOrderDto } from "./dto/create-order.dto";
import { OrderStatus } from "./entities/order.entity";
import { UpdateOrderDto } from "./dto/update-order.dto";

@Controller("orders")
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post("create-order")
  async create(@Body() dto: CreateOrderDto) {
    try {
      return await this.ordersService.createOrder(dto);
    } catch (err) {
      throw new BadRequestException(err.message);
    }
  }

  @Get("get-orders/:orderId")
  async getByOrderId(@Param("orderId") orderId: string) {
    try {
      return await this.ordersService.getOrderById(orderId);
    } catch (err) {
      throw new BadRequestException(err.message);
    }
  }

  @Get("get-orders/shopkeeper/:shopkeeperId")
  async getByField(@Param("shopkeeperId") shopkeeperId: string) {
    try {
      return await this.ordersService.getOrdersByShopkeeperId(shopkeeperId);
    } catch (err) {
      throw new BadRequestException(err.message);
    }
  }

  @Get("get-orders/user/:userId")
  async getByUser(@Param("userId") userId: string) {
    try {
      return await this.ordersService.getOrdersByUserId(userId);
    } catch (err) {
      throw new BadRequestException(err.message);
    }
  }

  @Patch(":orderId/status")
  async updateOrderStatus(
    @Param("orderId") orderId: string,
    @Body() updateDTO: UpdateOrderDto
  ) {
    try {
      return await this.ordersService.updateOrderStatus(
        orderId,
        updateDTO.status
      );
    } catch (err) {
      throw new BadRequestException(err.message);
    }
  }

  @Get("customers/:shopkeeperId")
  async getCustomersByShopkeeper(@Param("shopkeeperId") shopkeeperId: string) {
    try {
      return await this.ordersService.getCustomersWithOrderSummary(
        shopkeeperId
      );
    } catch (error) {
      throw new InternalServerErrorException("Failed to retrieve customers");
    }
  }

  @Delete("delete-order/:orderId")
  async deleteOrder(@Param("orderId") orderId: string) {
    try {
      return await this.ordersService.deleteOrder(orderId);
    } catch (error) {
      throw error;
    }
  }
}
