import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Patch,
  UseGuards,
  Req,
  UseInterceptors,
  ParseUUIDPipe,
  UploadedFile,
  BadRequestException,
} from "@nestjs/common";
import { OrganizersService } from "./organizers.service";
import { LocalDto } from "../auth/dto/local.dto";
import { LoginDto } from "../admin/dto/login.dto";
import { AuthGuard } from "@nestjs/passport";
import { CreateOrganizerDto } from "./dto/createOrganizer.dto";
import { FileInterceptor } from "@nestjs/platform-express";
import { UpdateOrganizerDto } from "./dto/updateOrganizer.dto";
import { diskStorage } from "multer";
import { extname } from "path";

function qrStorage() {
  return diskStorage({
    destination: (_req, _file, cb) => cb(null, "./uploads/organizerPayments"),
    filename: (req, file, cb) => {
      // filename pattern: <shopkeeperId>-<timestamp>.<ext>
      const id = req.params?.id || "unknown";
      const ts = Date.now();
      const ext = extname(file.originalname || "") || ".png";
      cb(null, `${id}-${ts}${ext}`);
    },
  });
}

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

  @Get("profile-get/:id")
  // @UseGuards(AuthGuard("jwt"))
  async getProfile(@Param("id") id: string) {
    try {
      return this.organizersService.getProfile(id);
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  @Patch(":id/approve")
  async approve(@Param("id") id: string) {
    return this.organizersService.approve(id);
  }

  @Patch("profile/:id")
  @UseInterceptors(
    FileInterceptor("paymentURL", {
      storage: qrStorage(),
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.startsWith("image/")) {
          return cb(
            new BadRequestException("Only image files are allowed"),
            false
          );
        }
        cb(null, true);
      },
      limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB limit
    })
  )
  async updateProfile(
    @Param("id") id: string,
    @UploadedFile() paymentFile: Express.Multer.File,
    @Body() body: UpdateOrganizerDto
  ) {
    const paymentQrPublicUrl = paymentFile?.filename
      ? `/uploads/organizerPayments/${paymentFile.filename}`
      : null;

    console.log(paymentQrPublicUrl, "-------------------");

    return this.organizersService.updateProfile(id, body, paymentQrPublicUrl);
  }

  @Get("organizer/:slug")
  async getOrganizerBySlug(@Param("slug") slug: string) {
    try {
      return await this.organizersService.getOrganizerBySlug(slug);
    } catch (error) {
      throw error;
    }
  }
}
