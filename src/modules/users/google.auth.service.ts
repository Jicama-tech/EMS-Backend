import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { OAuth2Client } from "google-auth-library";

@Injectable()
export class GoogleAuthService {
  private client: OAuth2Client;

  constructor() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      throw new InternalServerErrorException("Missing GOOGLE_OAUTH_CLIENT_ID");
    }
    this.client = new OAuth2Client(clientId);
  }

  /**
   * Verify Google ID Token and return user profile info
   * @param idToken Google ID token from frontend Google sign-in
   */
  async verifyIdToken(idToken: string) {
    try {
      const ticket = await this.client.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();

      if (!payload) {
        throw new InternalServerErrorException("Invalid Google token payload");
      }

      return {
        email: payload.email,
        name: payload.name,
        picture: payload.picture,
        emailVerified: payload.email_verified,
        locale: payload.locale,
        sub: payload.sub, // Google user ID
      };
    } catch (error) {
      throw new InternalServerErrorException(
        "Google token verification failed: " + error.message
      );
    }
  }
}
