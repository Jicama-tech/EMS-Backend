import { Module } from "@nestjs/common";
import { OrganizerStoresService } from "./organizer-stores.service";
import { OrganizerStoresController } from "./organizer-stores.controller";
import { JwtService } from "@nestjs/jwt";
import {
  OrganizerStore,
  OrganizerStoreSchema,
} from "./entities/organizer-store.entity";
import { MongooseModule } from "@nestjs/mongoose/dist";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: OrganizerStore.name, schema: OrganizerStoreSchema },
    ]),
  ],
  controllers: [OrganizerStoresController],
  providers: [OrganizerStoresService, JwtService],
})
export class OrganizerStoresModule {}
