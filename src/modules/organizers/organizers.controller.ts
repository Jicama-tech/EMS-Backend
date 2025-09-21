import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Patch,
  UseGuards,
  Req,
} from "@nestjs/common";
import { OrganizersService } from "./organizers.service";
import { LocalDto } from "../auth/dto/local.dto";
import { LoginDto } from "../admin/dto/login.dto";
import { AuthGuard } from "@nestjs/passport";
import { CreateOrganizerDto } from "./dto/createOrganizer.dto";

@Controller("organizers")
export class OrganizersController {
  constructor(private organizersService: OrganizersService) {}

  @Post()
  async create(@Body() body: any) {
    return this.organizersService.create(body);
  }

  @Post("register")
  async register(@Body() dto: CreateOrganizerDto) {
    return await this.organizersService.registerOrganizer(dto);
  }

  // New endpoint to request an OTP
  @Post("request-otp")
  async requestOTP(@Body("businessEmail") email: string) {
    return this.organizersService.requestOTP(email);
  }

  // New endpoint to verify the OTP and log in
  @Post("login")
  async verifyOTP(
    @Body("businessEmail") email: string,
    @Body("otp") otp: string
  ) {
    return this.organizersService.verifyOTP(email, otp);
  }

  // New endpoint to resend the OTP
  @Post("resend-otp")
  async resendOTP(@Body("businessEmail") email: string) {
    return this.organizersService.resendOTP(email);
  }

  @Get("events")
  @UseGuards(AuthGuard("jwt"))
  async list(@Req() req) {
    try {
      const organizerId = req.user.userId;
      return this.organizersService.list(organizerId);
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  @Get("dashboard-data")
  @UseGuards(AuthGuard("jwt"))
  async getDashboardData(@Req() req) {
    try {
      const organizerId = req.user.userId;
      return this.organizersService.getDashboardDataForOrganizer(organizerId);
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  @Get(":email")
  async getByEmail(@Param("email") email: string) {
    try {
      return await this.organizersService.findByEmail(email);
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  @Get(":id")
  @UseGuards(AuthGuard("jwt"))
  async getProfile(@Param("id") id: string) {
    return this.organizersService.getprofile(id);
  }

  @Patch(":id/approve")
  async approve(@Param("id") id: string) {
    return this.organizersService.approve(id);
  }
}
