import { Module } from "@nestjs/common";
import { ProductsService } from "./products.service";
import { ProductsController } from "./products.controller";
import { MongooseModule } from "@nestjs/mongoose/dist";
import { ProductSchema } from "./entities/product.entity";
import { ShopkeeperSchema } from "../shopkeepers/schemas/shopkeeper.schema";
import { MulterModule } from "@nestjs/platform-express";
import { memoryStorage } from "multer";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: "Product", schema: ProductSchema },
      { name: "Shopkeeper", schema: ShopkeeperSchema },
    ]),
    MulterModule.register({
      storage: memoryStorage(),
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
      },
    }),
  ],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService, MongooseModule],
})
export class ProductsModule {}
