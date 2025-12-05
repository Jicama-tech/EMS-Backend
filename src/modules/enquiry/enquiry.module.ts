import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { EnquiryService } from "./enquiry.service";
import { EnquiryController } from "./enquiry.controller";
import { Enquiry, EnquirySchema } from "./entities/enquiry.entity";
import { MailModule } from "../roles/mail.module";

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Enquiry.name, schema: EnquirySchema }]),
    MailModule,
  ],
  controllers: [EnquiryController],
  providers: [EnquiryService],
  exports: [EnquiryService],
})
export class EnquiryModule {}
