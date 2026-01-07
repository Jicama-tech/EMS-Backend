import { Module } from "@nestjs/common";
import { ShopkeeperStoresService } from "./shopkeeper-stores.service";
import { ShopkeeperStoresController } from "./shopkeeper-stores.controller";
import { MongooseModule } from "@nestjs/mongoose/dist";
import {
  ShopfrontStore,
  ShopfrontStoreSchema,
} from "./entities/shopkeeper-store.entity";
import { JwtService } from "@nestjs/jwt";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ShopfrontStore.name, schema: ShopfrontStoreSchema },
    ]),
  ],
  controllers: [ShopkeeperStoresController],
  providers: [ShopkeeperStoresService, JwtService],
})
export class ShopkeeperStoresModule {}
