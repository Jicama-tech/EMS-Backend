import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Res,
  BadRequestException,
} from "@nestjs/common";
import { TicketsService } from "./tickets.service";
import { CreateTicketDto } from "./dto/create-ticket.dto";
import { UpdateTicketDto } from "./dto/update-ticket.dto";
import { Response } from "express";
import * as fs from "fs";

@Controller("tickets")
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Post("create-ticket")
  create(@Body() createTicketDto: CreateTicketDto) {
    console.log(createTicketDto, "createTicketDto");
    return this.ticketsService.create(createTicketDto);
  }

  @Get()
  findAll() {
    return this.ticketsService.findAll();
  }

  @Get("customer/:email")
  getCustomerTickets(@Param("email") email: string) {
    return this.ticketsService.getCustomerTickets(email);
  }

  @Get("organizer/:organizerId")
  getOrganizerTickets(@Param("organizerId") organizerId: string) {
    return this.ticketsService.getOrganizerTickets(organizerId);
  }

  @Get("event/:eventId")
  getEventTickets(@Param("eventId") eventId: string) {
    return this.ticketsService.getEventTickets(eventId);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.ticketsService.findOne(id);
  }

  @Get("by-ticket-id/:ticketId")
  findByTicketId(@Param("ticketId") ticketId: string) {
    return this.ticketsService.findByTicketId(ticketId);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() updateTicketDto: UpdateTicketDto) {
    return this.ticketsService.update(id, updateTicketDto);
  }

  @Patch("use/:ticketId")
  markAsUsed(@Param("ticketId") ticketId: string) {
    return this.ticketsService.markTicketAsUsed(ticketId);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.ticketsService.remove(id);
  }

  @Patch("mark-attendance/:ticketId")
  async markAttendance(@Param("ticketId") ticketId: string) {
    try {
      console.log(ticketId);
      return await this.ticketsService.markAttendance(ticketId);
    } catch (error) {
      throw error;
    }
  }
}
