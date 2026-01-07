import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { UsersService } from "./users.service";
import { UsersController } from "./users.controller";
import { User, UserSchema } from "./schemas/user.schema";
import { JwtModule } from "@nestjs/jwt";
import { OtpModule } from "../otp/otp.module";
import { GoogleAuthService } from "./google.auth.service";

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    JwtModule.register({
      secret: process.env.JWT_ACCESS_SECRET || "secretKey",
      signOptions: { expiresIn: "24h" },
    }),
    OtpModule, // Import OtpModule to use OtpService
  ],
  providers: [UsersService, GoogleAuthService],
  controllers: [UsersController],
  exports: [UsersService, MongooseModule],
})
export class UsersModule {}
