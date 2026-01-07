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
        whatsAppNumber: data.whatsAppNumber,
        firstName: data.firstName,
        lastName: data.lastName,
      });
      console.log(created, "created");
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
      const user = await this.userModel.find({ _id: id });

      if (!user) {
        throw new NotFoundException("User not found");
      }

      console.log(user, "User");

      return { message: "User Found", data: user };
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
  async verifyEmailForCart(email: string, whatsAppNumber: string) {
    try {
      // Step 1: Find user by WhatsApp Number
      let user = await this.userModel.findOne({
        whatsAppNumber: whatsAppNumber,
      });

      console.log(whatsAppNumber, "whatsAppNumber");
      console.log(user, "user");

      let isNewUser = false;

      if (user) {
        // Step 2: Update email if needed
        let shouldSave = false;
        if (user.email) {
          if (user.email !== email) {
            user.email = email;
            shouldSave = true;
          } else if (user.email === null) {
            user.email = email;
            shouldSave = true;
          }
        } else {
          user.email = email;
          shouldSave = true;
        }
        if (shouldSave) await user.save();

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
          message: "User found and email ensured/updated",
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
      } else {
        // No user found, create new
        // You may set fullName based on your own logic, here defaulting to prefix of email
        const fullName = email.split("@")[0];
        const createUserDto: CreateUserDto = {
          name: fullName,
          email,
          password: null,
          provider: "google", // Or "email" if you prefer
          providerId: null,
          whatsAppNumber: whatsAppNumber || null,
        };

        user = await this.create(createUserDto);

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
      }
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
  async sendWhatsAppOtp(whatsAppNumber: string) {
    try {
      const user = await this.userModel.findOne({ whatsAppNumber });
      // if (!user) throw new NotFoundException("User not found");

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

  async verifyWhatsAppOtp(
    fullName: string,
    whatsAppNumber: string,
    otp: string
  ) {
    try {
      let user = await this.userModel.findOne({ whatsAppNumber });

      if (!user) {
        // Create new user with fullName and WhatsApp Number
        const createUserDto: CreateUserDto = {
          name: fullName,
          email: null,
          password: null,
          provider: null,
          providerId: null,
          whatsAppNumber,
        };
        user = await this.create(createUserDto);
      }

      // If user already verified with same number
      if (user.whatsAppNumber === whatsAppNumber) {
        return {
          success: true,
          message: "WhatsApp number already verified",
          user: {
            id: user._id,
            name: user.name,
            whatsAppNumber: user.whatsAppNumber,
            isWhatsAppVerified: true,
          },
        };
      }

      // Verify the sent OTP
      await this.otpService.verifyWhatsAppOtp(whatsAppNumber, "user", otp);

      // Update user with WhatsApp Number and fullName if changed
      if (user.name !== fullName || user.whatsAppNumber !== whatsAppNumber) {
        const updateData: UpdateUserDto = {
          name: fullName,
          whatsAppNumber,
        };
        const userId = user._id.toString();
        const updatedUser = await this.updateUser(userId, updateData);
        return {
          success: true,
          message: "WhatsApp verified and user updated",
          user: {
            id: updatedUser.data._id,
            name: updatedUser.data.name,
            whatsAppNumber: updatedUser.data.whatsAppNumber,
            isWhatsAppVerified: true,
          },
        };
      }

      return {
        success: true,
        message: "WhatsApp verified",
        user: {
          id: user._id,
          name: user.name,
          whatsAppNumber: user.whatsAppNumber,
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

  async createUserByShopkeeper(data: CreateUserDto, shopkeeperId: string) {
    try {
      const user = await this.userModel.findOne({
        whatsAppNumber: data.whatsAppNumber,
        email: data?.email,
      });

      if (user) {
        throw new BadRequestException("User Already Exists");
      }

      const created = new this.userModel({
        name: data.firstName + " " + data.lastName,
        email: data.email,
        provider: "Shopkeeper",
        providerId: shopkeeperId,
        whatsAppNumber: data.whatsAppNumber,
        firstName: data.firstName,
        lastName: data.lastName,
      });

      const saved = await created.save();
      return { message: "User created successfully", data: saved };
    } catch (error) {
      throw error;
    }
  }

  async fetchUsersByShopkeeperId(shopkeeperId: string) {
    try {
      const user = await this.userModel.find({
        provider: "Shopkeeper",
        providerId: shopkeeperId,
      });

      if (!user) {
        throw new NotFoundException("user not found");
      }

      return { message: "Users fetched successfully", data: user };
    } catch (error) {
      throw error;
    }
  }

  async fetchUserByWhatsAppNumber(whatsAppNumber: string) {
    try {
      const user = await this.userModel.findOne({
        whatsAppNumber: whatsAppNumber,
      });

      if (!user) {
        throw new NotFoundException("User Not Found");
      }

      return { message: "user Found", data: user };
    } catch (error) {
      throw error;
    }
  }
}
