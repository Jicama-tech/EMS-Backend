import { Model } from "mongoose";
import {
  Injectable,
  InternalServerErrorException,
  Logger,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { User, UserDocument } from "./schemas/user.schema";
import { CreateUserDto } from "./dto/create-users.dto";
import { UpdateUserDto } from "./dto/update-users.dto";
import { JwtService } from "@nestjs/jwt";
import { OtpService } from "../otp/otp.service";
import { GoogleAuthService } from "./google.auth.service";

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    private readonly jwtService: JwtService,
    private readonly otpService: OtpService,
    private readonly googleService: GoogleAuthService
  ) {}

  async create(data: CreateUserDto) {
    try {
      const created = new this.userModel({
        name: data.name,
        email: data.email,
        password: data.password,
        provider: data.provider,
        providerId: data.providerId,
      });
      return await created.save();
    } catch (error) {
      console.error(`Failed to create user: ${error.message}`);
      throw new InternalServerErrorException(
        "An error occurred while creating the user."
      );
    }
  }

  async findByEmail(email: string) {
    try {
      return await this.userModel.findOne({ email }).exec();
    } catch (error) {
      console.error(`Failed to find user by email: ${error.message}`);
      return null;
    }
  }

  async findByProviderId(providerId: string, provider: string) {
    try {
      return await this.userModel.findOne({ providerId, provider }).exec();
    } catch (error) {
      console.error(`Failed to find user by provider ID: ${error.message}`);
      return null;
    }
  }

  async findById(id: string) {
    try {
      return await this.userModel.findById(id).exec();
    } catch (error) {
      console.error(`Failed to find user by ID: ${error.message}`);
      return null;
    }
  }

  async updateUser(id: string, updateDTO: UpdateUserDto) {
    try {
      const user = await this.userModel.findByIdAndUpdate(id, updateDTO, {
        new: true,
      });
      if (!user) {
        throw new NotFoundException("User not found");
      }
      return { message: "User updated successfully", data: user };
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  /**
   * Verify Google ID token and create/find user, then generate JWT token
   * Input: idToken string (from frontend Google sign-in)
   */
  async verifyGoogleTokenAndGetUser(idToken: string) {
    try {
      // Verify token and get Google user profile info
      const googleProfile = await this.googleService.verifyIdToken(idToken);

      // Try find user by providerId and google as provider
      let user = await this.findByProviderId(googleProfile.sub, "google");

      if (!user) {
        // Create user if doesn't exist
        const createUserDto: CreateUserDto = {
          name: googleProfile.name,
          email: googleProfile.email,
          password: null,
          provider: "google",
          providerId: googleProfile.sub,
        };
        user = await this.create(createUserDto);
      }

      // Generate JWT token
      const payload = {
        name: user.name,
        email: user.email,
        sub: user._id,
        roles: user.roles,
      };

      const token = this.jwtService.sign(payload, {
        secret: process.env.JWT_ACCESS_SECRET,
        expiresIn: "24h",
      });

      return {
        success: true,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          provider: user.provider,
          providerId: user.providerId,
          whatsAppNumber: user.whatsAppNumber || null,
          isWhatsAppVerified: !!user.whatsAppNumber,
        },
        token,
      };
    } catch (error) {
      console.error("Google token verification error:", error);
      throw new InternalServerErrorException(
        "Failed to verify Google token: " + error.message
      );
    }
  }

  /**
   * EMAIL VERIFICATION FOR CART (using Google backend flow)
   * 1. Check user by email
   * 2. If exists, return data & token
   * 3. Else, call Google backend flow to create user (simulate)
   */
  async verifyEmailForCart(email: string) {
    try {
      let user = await this.findByEmail(email);

      if (user) {
        const payload = {
          name: user.name,
          email: user.email,
          sub: user._id,
          roles: user.roles,
        };
        const token = this.jwtService.sign(payload, {
          secret: process.env.JWT_ACCESS_SECRET,
          expiresIn: "24h",
        });

        return {
          success: true,
          message: "User found",
          user: {
            id: user._id,
            name: user.name,
            email: user.email,
            whatsAppNumber: user.whatsAppNumber || null,
            isWhatsAppVerified: !!user.whatsAppNumber,
          },
          token,
          isNewUser: false,
        };
      }

      // Simulated Google backend flow (no real API call here)
      // You can integrate real Google token verification if email+token provided
      const googleUser = null; // or call googleService if you get Google ID token differently

      if (googleUser) {
        const createUserDto: CreateUserDto = {
          name: googleUser.name,
          email: googleUser.email,
          password: null,
          provider: "google",
          providerId: googleUser.sub,
        };

        user = await this.create(createUserDto);
      } else {
        const createUserDto: CreateUserDto = {
          name: email.split("@")[0],
          email,
          password: null,
          provider: "google",
          providerId: null,
        };

        user = await this.create(createUserDto);
      }

      const payload = {
        name: user.name,
        email: user.email,
        sub: user._id,
        roles: user.roles,
      };
      const token = this.jwtService.sign(payload, {
        secret: process.env.JWT_ACCESS_SECRET,
        expiresIn: "24h",
      });

      return {
        success: true,
        message: "User created successfully",
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          whatsAppNumber: user.whatsAppNumber || null,
          isWhatsAppVerified: !!user.whatsAppNumber,
        },
        token,
        isNewUser: true,
      };
    } catch (error) {
      console.error("Email verification error:", error);
      throw new InternalServerErrorException(
        "Failed to verify email: " + error.message
      );
    }
  }

  /**
   * WHATSAPP OTP RELATED METHODS (send, verify, update user)
   */
  async sendWhatsAppOtp(userId: string, whatsAppNumber: string) {
    try {
      const user = await this.findById(userId);
      if (!user) throw new NotFoundException("User not found");

      // if (user.whatsAppNumber) {
      //   return {
      //     success: false,
      //     message: "WhatsApp number already verified",
      //     alreadyVerified: true,
      //   };
      // }

      await this.otpService.sendWhatsAppOtp(whatsAppNumber, "user");

      return {
        success: true,
        message: "OTP sent",
        whatsAppNumber,
      };
    } catch (error) {
      console.error("WhatsApp OTP send error:", error);
      throw new InternalServerErrorException(
        "Failed to send WhatsApp OTP: " + error.message
      );
    }
  }

  async verifyWhatsAppOtp(userId: string, whatsAppNumber: string, otp: string) {
    try {
      const user = await this.findById(userId);
      if (!user) throw new NotFoundException("User not found");

      if (user.whatsAppNumber) {
        return {
          success: false,
          message: "WhatsApp number already verified",
          alreadyVerified: true,
        };
      }

      await this.otpService.verifyWhatsAppOtp(whatsAppNumber, "user", otp);

      const updatedUser = await this.updateUser(userId, { whatsAppNumber });

      return {
        success: true,
        message: "WhatsApp verified and saved",
        user: {
          id: updatedUser.data._id,
          name: updatedUser.data.name,
          email: updatedUser.data.email,
          whatsAppNumber: updatedUser.data.whatsAppNumber,
          isWhatsAppVerified: true,
        },
      };
    } catch (error) {
      console.error("WhatsApp OTP verify error:", error);
      if (error.message.includes("Invalid or expired OTP")) {
        throw new BadRequestException("Invalid or expired OTP");
      }
      throw new InternalServerErrorException(
        "Failed to verify WhatsApp OTP: " + error.message
      );
    }
  }
}
