import {
  Controller,
  Get,
  Req,
  UseGuards,
  Res,
  InternalServerErrorException,
  ConflictException,
  Body,
  Post,
  Param,
  BadRequestException,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { Request, Response } from "express";
import { UsersService } from "./users.service";
import { JwtService } from "@nestjs/jwt";
import { CreateUserDto } from "./dto/create-users.dto";

@Controller("users")
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService
  ) {}

  @Get("google")
  @UseGuards(AuthGuard("google"))
  async googleAuth(@Req() req: Request) {
    // Passport will handle the redirect. No code needed here.
  }

  @Get("google/callback")
  @UseGuards(AuthGuard("google"))
  async googleAuthRedirect(@Req() req: Request, @Res() res: Response) {
    try {
      const userFromGoogle = req.user as any;
      if (!userFromGoogle) {
        return res.redirect("https://eventsh.com/login?error=auth_failed");
      }

      let user = await this.usersService.findByProviderId(
        userFromGoogle.providerId,
        userFromGoogle.provider
      );

      if (!user) {
        const createUserDto: CreateUserDto = {
          name: userFromGoogle.name,
          email: userFromGoogle.email,
          password: userFromGoogle.password,
          provider: userFromGoogle.provider,
          providerId: userFromGoogle.providerId,
        };
        user = await this.usersService.create(createUserDto);
      }

      const payload = { email: user.email, sub: user._id, roles: user.roles };
      const token = this.jwtService.sign(payload);
      return res.redirect(`https://eventsh.com/user-dashboard?token=${token}`);
    } catch (error) {
      return res.redirect("https://eventsh.com/login?error=auth_failed");
    }
  }

  @Get("verify/:email")
  async verifyEmail(@Param("email") email: string) {
    try {
      return await this.usersService.findByEmail(email);
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  @Post("register")
  async register(@Body() createUserDto: CreateUserDto) {
    try {
      const existingUser = await this.usersService.findByEmail(
        createUserDto.email
      );
      if (existingUser) {
        throw new ConflictException("User with this email already exists.");
      }
      return await this.usersService.create(createUserDto);
    } catch (error) {
      throw new InternalServerErrorException(
        "An error occurred during registration."
      );
    }
  }

  /**
   * NEW: Email verification for cart
   */
  @Post("verify-email-for-cart")
  async verifyEmailForCart(
    @Body() body: { email: string; whatsAppNumber: string }
  ) {
    try {
      if (!body.email || !body.whatsAppNumber) {
        throw new BadRequestException("Please provide everything");
      }
      return await this.usersService.verifyEmailForCart(
        body.email,
        body.whatsAppNumber
      );
    } catch (error) {
      console.error("Email verification error:", error);
      throw error;
    }
  }

  /**
   * NEW: Send WhatsApp OTP
   */
  @Post("send-whatsapp-otp")
  async sendWhatsAppOtp(@Body() body: { whatsAppNumber: string }) {
    try {
      if (!body.whatsAppNumber) {
        throw new BadRequestException("userId and whatsAppNumber are required");
      }
      return await this.usersService.sendWhatsAppOtp(body.whatsAppNumber);
    } catch (error) {
      console.error("WhatsApp OTP send error:", error);
      throw error;
    }
  }

  /**
   * NEW: Verify WhatsApp OTP
   */
  @Post("verify-whatsapp-otp")
  async verifyWhatsAppOtp(
    @Body()
    body: {
      // userId: string;
      whatsAppNumber: string;
      otp: string;
      fullName: string;
    }
  ) {
    try {
      if (!body.whatsAppNumber || !body.otp) {
        throw new BadRequestException(
          "userId, whatsAppNumber, and otp are required"
        );
      }
      return await this.usersService.verifyWhatsAppOtp(
        body.fullName,
        body.whatsAppNumber,
        body.otp
      );
    } catch (error) {
      console.error("WhatsApp OTP verification error:", error);
      throw error;
    }
  }

  /**
   * NEW: Check WhatsApp verification status
   */
  // @Get("whatsapp-status/:userId")
  // async checkWhatsAppStatus(@Param("userId") userId: string) {
  //   try {
  //     if (!userId) {
  //       throw new BadRequestException("userId is required");
  //     }
  //     return await this.usersService.checkWhatsAppStatus(userId);
  //   } catch (error) {
  //     console.error("WhatsApp status check error:", error);
  //     throw error;
  //   }
  // }

  @Post("get-by-email")
  async getProfile(@Body() email: string) {
    try {
      return await this.usersService.findByEmail(email);
    } catch (error) {
      throw error;
    }
  }
}
