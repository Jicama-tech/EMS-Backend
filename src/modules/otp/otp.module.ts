import { Module, forwardRef } from "@nestjs/common";
import { OtpService } from "./otp.service";
import { OtpController } from "./otp.controller";
import { MongooseModule } from "@nestjs/mongoose";
import { MailModule } from "../roles/mail.module";
import { Otp, OtpSchema } from "./entities/otp.entity";
import { ShopkeepersModule } from "../shopkeepers/shopkeepers.module";
import { OrganizersModule } from "../organizers/organizers.module";

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Otp.name, schema: OtpSchema }]),
    MailModule,
    forwardRef(() => ShopkeepersModule),
    forwardRef(() => OrganizersModule), // Wrap here with forwardRef
  ],
  controllers: [OtpController],
  providers: [OtpService],
  exports: [OtpService],
})
export class OtpModule {}
