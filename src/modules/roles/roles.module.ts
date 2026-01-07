// role.module.ts
import { Module } from "@nestjs/common";
import { RoleController } from "./roles.controller";
import { RoleService } from "./roles.service";
import { RegistrationService } from "./registration.service";
import { MailService } from "./mail.service";
import { OrganizersService } from "../organizers/organizers.service";
import { ShopkeepersService } from "../shopkeepers/shopkeepers.service";
import { MongooseModule } from "@nestjs/mongoose/dist";
import { OrganizerSchema } from "../organizers/schemas/organizer.schema";
import { ShopkeeperSchema } from "../shopkeepers/schemas/shopkeeper.schema";
import { MailModule } from "./mail.module";
import { JwtModule } from "@nestjs/jwt";
import { OrganizersModule } from "../organizers/organizers.module";
import { ShopkeepersModule } from "../shopkeepers/shopkeepers.module";

@Module({
  imports: [
    ShopkeepersModule,
    OrganizersModule,
    MailModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || "secretKey",
      signOptions: { expiresIn: "1d" },
    }),
    MongooseModule.forFeature([
      { name: "Organizer", schema: OrganizerSchema },
      { name: "Shopkeeper", schema: ShopkeeperSchema },
    ]),
    // You still need MongooseModule.forFeature() here
    // if those services use Mongo models directly
  ],
  controllers: [RoleController],
  providers: [RoleService, RegistrationService],
  exports: [RoleService],
})
export class RolesModule {}
