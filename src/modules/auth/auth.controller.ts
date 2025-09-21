import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
  Res,
  ConflictException,
  InternalServerErrorException,
} from "@nestjs/common";
import { AuthService } from "./auth.service";
import { LocalDto } from "./dto/local.dto";
import { GoogleAuthGuard } from "./guards/google.guard";
import { InstagramAuthGuard } from "./guards/instagram.guard";
import { Request, Response } from "express";
import { CreateUserDto } from "../users/dto/create-users.dto";
import { UsersService } from "../users/users.service";
import { JwtService } from "@nestjs/jwt";
import { AuthGuard } from "@nestjs/passport";

@Controller("auth")
export class AuthController {
  constructor(
    private authService: AuthService,
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService
  ) {}

  @Post("login")
  async login(@Body() dto: LocalDto) {
    const user = await this.authService.validateUser(dto.email, dto.password);
    if (!user) return { error: "Invalid credentials" };
    return this.authService.login(user);
  }

  @Post("register")
  async register(@Body() createUserDto: CreateUserDto) {
    try {
      const result = await this.usersService.create(createUserDto);
      return result;
    } catch (error) {
      console.error("Registration error:", error);
      throw new InternalServerErrorException(
        "An error occurred during registration."
      );
    }
  }

  @Get("google")
  @UseGuards(AuthGuard("google"))
  async googleAuth() {
    console.log("::::Vansh Sharma");
    // This is the initial endpoint to start the Google auth flow.
  }

  @Get("google/redirect")
  @UseGuards(AuthGuard("google"))
  async googleAuthRedirect(@Req() req: Request, @Res() res: Response) {
    try {
      console.log("Claeeddddddddd");
      const userFromGoogle = req.user as any;
      if (!userFromGoogle) {
        // return res.redirect("https://eventsh.com/login?error=auth_failed");
        return res.redirect("http://localhost:8080/login?error=auth_failed");
      }

      // 1. Check if the user already exists in your database
      let user = await this.usersService.findByEmail(userFromGoogle.email);

      // 2. If the user doesn't exist, create a new one
      if (!user) {
        const createUserDto: CreateUserDto = {
          name: userFromGoogle.name,
          email: userFromGoogle.email,
          password: userFromGoogle.password,
          provider: userFromGoogle.oauthProvider,
          providerId: userFromGoogle.oauthId,
        };
        user = await this.usersService.create(createUserDto);
      }

      console.log(userFromGoogle, user, "userFromGoogle");

      // 3. Generate a JWT token
      const payload = {
        name: user.name,
        email: user.email,
        sub: user._id,
        roles: user.roles,
      };
      const token = this.jwtService.sign(payload, {
        secret: process.env.JWT_ACCESS_SECRET,
        expiresIn: "1h",
      });

      // 4. Redirect to the frontend with the token
      // This is the correct line to use!
      // return res.redirect(`https://eventsh.com/user-dashboard?token=${token}`);

      return res.redirect(
        `http://localhost:8080/user-dashboard?token=${token}`
      );
      // Remove the res.json line
      // res.json({ message: "User logged in successfully", token });
    } catch (error) {
      console.error("Auth redirect error:", error);
      // return res.redirect("https://eventsh.com/login?error=auth_failed");
      return res.redirect("http://localhost:8080/login?error=auth_failed");
    }
  }

  @Get("instagram")
  @UseGuards(InstagramAuthGuard)
  async instagramAuth() {}

  @Get("instagram/redirect")
  @UseGuards(InstagramAuthGuard)
  async instagramRedirect(@Req() req: Request, @Res() res: Response) {
    const user = req.user as any;
    if (!user) {
      return res.redirect("http://localhost:8080/login?error=auth_failed");
    }

    // Check if the user exists based on provider ID, and if not, create them.
    // This is a placeholder for your logic.
    // The correct approach is to call a service method to handle this.
    // const createdUser = await this.authService.findOrCreateSocialUser({
    //   email: user.email,
    //   name: user.name,
    //   provider: "instagram",
    //   providerId: user.providerId,
    // });

    // const result = await this.authService.login(createdUser);
    // return res.redirect(
    //   `http://localhost:8080/dashboard?token=${result.token}`
    // );
  }
}
