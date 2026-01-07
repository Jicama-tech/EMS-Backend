import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { StallsService } from "./stalls.service";
import { StallsController } from "./stalls.controller";
import { Stall, StallSchema } from "./entities/stall.entity";
import { OtpModule } from "../otp/otp.module";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Stall.name, schema: StallSchema },
      // Import Shopkeeper schema from your shared schemas
      { name: "Shopkeeper", schema: "ShopkeeperSchema" },
      // Import Event schema from your shared schemas
      { name: "Event", schema: "EventSchema" },
      { name: "Organizer", schema: "OrganizerSchema" },
    ]),
    OtpModule,
  ],
  controllers: [StallsController],
  providers: [StallsService],
  exports: [StallsService],
})
export class StallsModule {}
