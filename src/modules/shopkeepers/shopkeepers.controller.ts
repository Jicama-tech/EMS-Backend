import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { ShopkeepersService } from "./shopkeepers.service";
import { LoginDto } from "../admin/dto/login.dto";
import { CreateShopkeeperDto } from "./dto/createShopkeeper.dto";
import { AuthGuard } from "@nestjs/passport";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { diskStorage } from "multer";
import { extname } from "path";
import { FileInterceptor } from "@nestjs/platform-express";

// DTO for OTP requests
class RequestOTPDto {
  email: string;
}

class VerifyOTPDto {
  email: string;
  otp: string;
}

function qrStorage() {
  return diskStorage({
    destination: (_req, _file, cb) => cb(null, "./uploads/shopkeeperPayment"),
    filename: (req, file, cb) => {
      // filename pattern: <shopkeeperId>-<timestamp>.<ext>
      const id = req.params?.id || "unknown";
      const ts = Date.now();
      const ext = extname(file.originalname || "") || ".png";
      cb(null, `${id}-${ts}${ext}`);
    },
  });
}

@Controller("shopkeepers")
export class ShopkeepersController {
  constructor(private shopkeepersService: ShopkeepersService) {}

  @Post()
  async create(@Body() body: CreateShopkeeperDto) {
    console.log(body, "Vansh Sharma");
    return this.shopkeepersService.create(body);
  }

  @Get("get-all-shopkeepers")
  async list() {
    try {
      return await this.shopkeepersService.list();
    } catch (error) {
      throw error;
    }
  }

  @Get(":email")
  async getByEmail(@Param("email") email: string) {
    try {
      return await this.shopkeepersService.getByEmail(email);
    } catch (error) {
      throw error;
    }
  }

  // New OTP-based authentication endpoints
  @Post("request-otp")
  async requestOTP(@Body() body: any) {
    try {
      console.log(body, "vansh Sharm a");
      return await this.shopkeepersService.requestOTP(body.email);
    } catch (error) {
      throw error;
    }
  }

  @Post("verify-otp")
  async verifyOTP(@Body() body: any) {
    try {
      console.log(body, "vansh Sharma");
      return await this.shopkeepersService.verifyOTP(body.email, body.otp);
    } catch (error) {
      throw error;
    }
  }

  @Post("resend-otp")
  async resendOTP(@Body() body: RequestOTPDto) {
    try {
      return await this.shopkeepersService.resendOTP(body.email);
    } catch (error) {
      throw error;
    }
  }

  // Original login method (keeping for backward compatibility)
  @Post("login")
  async login(@Body() body: LoginDto) {
    try {
      return await this.shopkeepersService.login(body);
    } catch (error) {
      throw error;
    }
  }

  @Get("profile")
  @UseGuards(AuthGuard("jwt"))
  async getProfile(@Req() req: any) {
    try {
      console.log(req.user.userId, "Vansh Sharmasuodvuisdbvhsdbv");
      const shopkeeperId = req.user.sub;
      return await this.shopkeepersService.get(shopkeeperId);
    } catch (error) {
      throw error;
    }
  }

  @Post("register")
  async register(@Body() body: CreateShopkeeperDto) {
    try {
      console.log(body, "Vansh Sharma");
      return await this.shopkeepersService.register(body);
    } catch (error) {
      throw error;
    }
  }

  @Get("Shopkeeper-detail/:id")
  async getShopkeeperDetail(@Param("id") id: string) {
    try {
      console.log(id, "Vansh ");
      return await this.shopkeepersService.get(id);
    } catch (error) {}
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
      limits: { fileSize: 5 * 1024 * 1024 },
    })
  )
  async updateProfile(
    @Param("id") id: string,
    @UploadedFile() paymentURL: Express.Multer.File,
    @Body() body: any // or UpdateShopkeeperDto if you bind DTO validation
  ) {
    // Construct public URL if a file was uploaded.
    // main.ts serves /uploads, so this becomes accessible at http://localhost:3000/uploads/...
    const paymentQrPublicUrl = paymentURL?.filename
      ? `/uploads/shopkeeperPayment/${paymentURL.filename}`
      : null;

    console.log(paymentQrPublicUrl, "Vansh Sharma");

    return this.shopkeepersService.updateProfile(id, body, paymentQrPublicUrl);
  }

  @Get("profile/:whatsAppNumber")
  async getProfileByWhatsAppNumber(
    @Param("whatsAppNumber") whatsAppNumber: string
  ) {
    try {
      return await this.shopkeepersService.whatsAppNumberExists(whatsAppNumber);
    } catch (error) {
      throw error;
    }
  }
}
