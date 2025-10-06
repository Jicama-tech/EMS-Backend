import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { TicketsService } from "./tickets.service";
import { TicketsController } from "./tickets.controller";
import { Ticket, TicketSchema } from "./entities/ticket.entity";
import { Event, EventSchema } from "../events/schemas/event.schema";
import {
  Organizer,
  OrganizerSchema,
} from "../organizers/schemas/organizer.schema";
import { MailModule } from "../roles/mail.module";
// import { WhatsAppService } from "../otp/whatsapp.service";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Ticket.name, schema: TicketSchema },
      { name: Event.name, schema: EventSchema },
      { name: Organizer.name, schema: OrganizerSchema },
    ]),
    MailModule,
  ],
  controllers: [TicketsController],
  providers: [TicketsService],
  exports: [TicketsService],
})
export class TicketsModule {}
