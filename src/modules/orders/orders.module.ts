import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { OrdersController } from "./orders.controller";
import { OrdersService } from "./orders.service";
import { Order, OrderSchema } from "./entities/order.entity";
import { Product, ProductSchema } from "../products/entities/product.entity";
import { User, UserSchema } from "../users/schemas/user.schema";
import {
  Shopkeeper,
  ShopkeeperSchema,
} from "../shopkeepers/schemas/shopkeeper.schema";
import { MailModule } from "../roles/mail.module"; // Import MailModule providing MailService
import { ProductsModule } from "../products/products.module";
import { ShopkeepersModule } from "../shopkeepers/shopkeepers.module";
import { UsersModule } from "../users/users.module";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: Product.name, schema: ProductSchema },
      { name: User.name, schema: UserSchema },
      { name: Shopkeeper.name, schema: ShopkeeperSchema },
    ]),
    MailModule, // Add MailModule here so MailService can be injected
    UsersModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService], // Remove MailService here, provided by MailModule
  exports: [OrdersService, MongooseModule],
})
export class OrdersModule {}
