import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { UsersModule } from "../users/users.module";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { JwtStrategy } from "./strategies/jwt.strategy";
import { GoogleStrategy } from "./strategies/google.strategy";
import { InstagramStrategy } from "./strategies/instagram.strategy";
import { GoogleShopkeeperStrategy } from "./strategies/shopkeeper-google.strategy";
import { RolesModule } from "../roles/roles.module";

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_ACCESS_SECRET || "secret",
      signOptions: { expiresIn: process.env.JWT_ACCESS_EXPIRY || "900s" },
    }),
    UsersModule,
    RolesModule,
  ],
  providers: [
    AuthService,
    JwtStrategy,
    GoogleStrategy,
    GoogleShopkeeperStrategy,
    InstagramStrategy,
  ],
  controllers: [AuthController],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
