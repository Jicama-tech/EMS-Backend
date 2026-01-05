import { Injectable, NotFoundException } from "@nestjs/common";
import { OrganizersService } from "../organizers/organizers.service";
import { ShopkeepersService } from "../shopkeepers/shopkeepers.service";
import { RegistrationService } from "../roles/registration.service";
import { MailService } from "../roles/mail.service";

@Injectable()
export class RoleService {
  constructor(
    private readonly organizerService: OrganizersService,
    private readonly shopkeeperService: ShopkeepersService,
    private readonly registrationService: RegistrationService,
    private readonly mailService: MailService
  ) {}

  // Check if user already has this role and handle accordingly
  async checkRoleAvailability(
    email: string,
    name: string,
    role: "organizer" | "shopkeeper"
  ) {
    if (role === "organizer") {
      const organizer = await this.organizerService.findByEmail(email);
      if (organizer) {
        return {
          found: true,
          message: "Organizer found. Please use password login.",
          data: { email, role: "organizer" },
        };
      }
    } else if (role === "shopkeeper") {
      const shopkeeper = await this.shopkeeperService.getByEmail(email);
      if (shopkeeper) {
        // Shopkeeper found - send OTP for login
        try {
          const otpResult = await this.shopkeeperService.requestOTP(email);
          return {
            found: true,
            otpSent: true,
            message: "Shopkeeper found. OTP sent to your registered email.",
            data: {
              email,
              role: "shopkeeper",
              expiresIn: otpResult.data.expiresIn,
            },
          };
        } catch (error) {
          return {
            found: true,
            otpSent: false,
            message:
              "Shopkeeper found but failed to send OTP. Please try again.",
            error: error.message,
            data: { email, role: "shopkeeper" },
          };
        }
      }
    }

    // User not found - proceed with registration
    return {
      found: false,
      message: `${role} not found. Please complete registration.`,
      user: { name, email, role },
    };
  }

  async checkRoleAvailability1(
    email: string,
    name: string,
    role: "organizer" | "shopkeeper"
  ) {
    if (role === "organizer") {
      const organizer = await this.organizerService.findByEmail(email);
      if (organizer) {
        return {
          found: true,
          message: "Organizer found. Please use password login.",
          data: { email, role: "organizer" },
        };
      }
    } else if (role === "shopkeeper") {
      const shopkeeper = await this.shopkeeperService.getByEmail(email);
      if (shopkeeper) {
        // Shopkeeper found - send OTP for login
        try {
          return {
            found: true,
            message: "Shopkeeper found. OTP sent to your registered email.",
            data: {
              email,
              role: "shopkeeper",
            },
          };
        } catch (error) {
          return {
            found: true,
            message:
              "Shopkeeper found but failed to send OTP. Please try again.",
            error: error.message,
            data: { email, role: "shopkeeper" },
          };
        }
      }
    }

    // User not found - proceed with registration
    return {
      found: false,
      message: `${role} not found. Please complete registration.`,
      user: { name, email, role },
    };
  }

  // Register the new role and send emails
  async registerRole(
    name: string,
    email: string,
    password: string,
    role: "organizer" | "shopkeeper"
  ) {
    try {
      // Create pending registration
      const registration = await this.registrationService.createRegistration({
        name,
        email,
        password,
        role,
      });

      // Send admin approval email
      await this.mailService.sendApprovalRequestToAdmin({
        name,
        email,
        role,
      });

      // Send confirmation email to user
      await this.mailService.sendConfirmationToUser({
        name,
        email,
        role,
      });

      return {
        success: true,
        message: `${role} registration submitted successfully. Please wait for admin approval.`,
        data: {
          name,
          email,
          role,
          status: "pending_approval",
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to register ${role}. Please try again.`,
        error: error.message,
      };
    }
  }

  // Verify OTP for shopkeeper login (new method)
  async verifyShopkeeperOTP(email: string, otp: string) {
    try {
      const result = await this.shopkeeperService.verifyOTP(email, otp);
      return {
        success: true,
        message: "OTP verified successfully. Login successful.",
        data: result.data,
      };
    } catch (error) {
      return {
        success: false,
        message: "OTP verification failed.",
        error: error.message,
      };
    }
  }

  // Resend OTP for shopkeeper (new method)
  async resendShopkeeperOTP(email: string) {
    try {
      const result = await this.shopkeeperService.resendOTP(email);
      return {
        success: true,
        message: "New OTP sent successfully.",
        data: result.data,
      };
    } catch (error) {
      return {
        success: false,
        message: "Failed to resend OTP.",
        error: error.message,
      };
    }
  }

  // Combined method for handling both check and action
  async handleRoleRequest(
    email: string,
    name: string,
    password: string,
    role: "organizer" | "shopkeeper"
  ) {
    // First check if user exists
    const availabilityResult = await this.checkRoleAvailability(
      email,
      name,
      role
    );

    if (availabilityResult.found) {
      if (role === "shopkeeper" && availabilityResult.otpSent) {
        // Shopkeeper found and OTP sent
        return {
          action: "otp_required",
          message: availabilityResult.message,
          data: availabilityResult.data,
        };
      } else {
        // Organizer found or shopkeeper found but OTP failed
        return {
          action: "login_required",
          message: availabilityResult.message,
          data: availabilityResult.data,
        };
      }
    } else {
      // User not found - proceed with registration
      const registrationResult = await this.registerRole(
        name,
        email,
        password,
        role
      );
      return {
        action: "registration_submitted",
        message: registrationResult.message,
        success: registrationResult.success,
        data: registrationResult.data,
      };
    }
  }
}
