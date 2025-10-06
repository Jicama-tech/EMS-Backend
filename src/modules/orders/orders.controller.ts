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
  Res,
  NotFoundException,
} from "@nestjs/common";
import { OrdersService } from "./orders.service";
import { CreateOrderDto } from "./dto/create-order.dto";
import { OrderStatus } from "./entities/order.entity";
import { UpdateOrderDto } from "./dto/update-order.dto";
import { Response } from "express";

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

  @Get(":id/receipt")
  async downloadReceipt(@Param("id") id: string, @Res() res: Response) {
    try {
      const receipt = await this.ordersService.generateReceipt(id);

      console.log(receipt);

      res.set({
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=receipt-${id.slice(-8)}.pdf`,
        "Content-Length": receipt.length,
      });

      return res.end(receipt);
    } catch (error) {
      throw new InternalServerErrorException("Failed to generate receipt");
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

  @Get("print-receipt/:id")
  async getPrintReceipt(@Param("id") orderId: string) {
    const printData = await this.ordersService.generatePrintReceipt(orderId);
    return printData;
  }

  @Post("create-print-data")
  async createPrintData(@Body() body: { orderId: string; printData: any[] }) {
    try {
      const printId = await this.ordersService.createPrintData(
        body.orderId,
        body.printData
      );
      return { printId };
    } catch (error) {
      throw new InternalServerErrorException("Failed to create print data");
    }
  }

  @Get("print-data/:printId")
  async getPrintData(@Param("printId") printId: string) {
    try {
      const printData = await this.ordersService.getPrintData(printId);
      if (!printData) {
        throw new NotFoundException("Print data not found");
      }
      return printData;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException("Failed to get print data");
    }
  }

  @Get("thermal-print/:id")
  async getThermalPrintData(@Param("id") orderId: string) {
    try {
      const printData =
        await this.ordersService.generateThermalPrintData(orderId);
      return printData;
    } catch (error) {
      throw new InternalServerErrorException(
        "Failed to generate thermal print data"
      );
    }
  }

  @Get("shopkeeper-info/:shopkeeperId")
  async getShopkeeperInfo(@Param("shopkeeperId") shopkeeperId: string) {
    try {
      const shopkeeperInfo =
        await this.ordersService.getShopkeeperInfo(shopkeeperId);
      return shopkeeperInfo;
    } catch (error) {
      throw new InternalServerErrorException("Failed to get shopkeeper info");
    }
  }
}
