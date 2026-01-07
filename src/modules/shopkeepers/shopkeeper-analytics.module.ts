import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { ShopkeeperAnalyticsService } from "./shopkeeper-analytics-report.service";
import { ShopkeeperAnalyticsController } from "./shopkeeper-analytics-report.controller";
import { Order, OrderSchema } from "../orders/entities/order.entity";
import { Product, ProductSchema } from "../products/entities/product.entity";
import { User, UserSchema } from "../users/schemas/user.schema";
import {
  Shopkeeper,
  ShopkeeperSchema,
} from "../shopkeepers/schemas/shopkeeper.schema";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: Product.name, schema: ProductSchema },
      { name: User.name, schema: UserSchema },
      { name: Shopkeeper.name, schema: ShopkeeperSchema },
    ]),
  ],
  controllers: [ShopkeeperAnalyticsController],
  providers: [ShopkeeperAnalyticsService],
  exports: [ShopkeeperAnalyticsService],
})
export class ShopkeeperAnalyticsModule {}
