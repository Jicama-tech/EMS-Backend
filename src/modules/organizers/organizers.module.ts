import { forwardRef, Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { OrganizersService } from "./organizers.service";
import { OrganizersController } from "./organizers.controller";
import { Organizer, OrganizerSchema } from "./schemas/organizer.schema";
import { JwtService } from "@nestjs/jwt";
import { EventSchema } from "../events/schemas/event.schema";
import { User, UserSchema } from "../users/schemas/user.schema";
import { MailService } from "../roles/mail.service";
import { OtpSchema } from "../otp/entities/otp.entity";
import { OtpModule } from "../otp/otp.module";
import { MailModule } from "../roles/mail.module";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: "Organizer", schema: OrganizerSchema },
      { name: "Event", schema: EventSchema },
      { name: "User", schema: UserSchema },
      { name: "Otp", schema: OtpSchema },
    ]),
    forwardRef(() => OtpModule),
    MailModule,
  ],
  providers: [OrganizersService, JwtService, MailService],
  controllers: [OrganizersController],
  exports: [OrganizersService, MongooseModule],
})
export class OrganizersModule {}
