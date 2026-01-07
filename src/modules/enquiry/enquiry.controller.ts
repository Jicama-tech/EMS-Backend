import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
  Query,
} from "@nestjs/common";
import { EnquiryService } from "./enquiry.service";
import { CreateEnquiryDto } from "./dto/create-enquiry.dto";
import { UpdateEnquiryDto } from "./dto/update-enquiry.dto";

@Controller("enquiry")
export class EnquiryController {
  constructor(private readonly enquiryService: EnquiryService) {}

  @Post("add-enquiry")
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createEnquiryDto: CreateEnquiryDto) {
    return this.enquiryService.create(createEnquiryDto);
  }

  @Get("get-all-enquiry")
  async findAll() {
    return this.enquiryService.findAll();
  }

  @Get("stats")
  async getStats() {
    return this.enquiryService.getEnquiryStats();
  }

  @Get("email/:emailId")
  async findByEmail(@Param("emailId") emailId: string) {
    return this.enquiryService.findByEmail(emailId);
  }

  @Get("type/:enquiryFor")
  async findByEnquiryType(@Param("enquiryFor") enquiryFor: string) {
    return this.enquiryService.findByEnquiryType(enquiryFor);
  }

  @Get(":id")
  async findOne(@Param("id") id: string) {
    return this.enquiryService.findOne(id);
  }

  @Patch(":id")
  async update(
    @Param("id") id: string,
    @Body() updateEnquiryDto: UpdateEnquiryDto
  ) {
    return this.enquiryService.update(id, updateEnquiryDto);
  }

  @Delete(":id")
  async remove(@Param("id") id: string) {
    return this.enquiryService.remove(id);
  }
}
