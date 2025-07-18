import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy } from "passport-microsoft";

@Injectable()
export class MicrosoftStrategy extends PassportStrategy(Strategy, "microsoft") {
  constructor() {
    if (!process.env.MICROSOFT_CLIENT_ID || !process.env.MICROSOFT_CLIENT_SECRET) {
      console.error(
        "Microsoft OAuth credentials are not set. Please check your environment variables.",
      );
    }

    super({
      clientID: process.env.MICROSOFT_CLIENT_ID || "test_microsoft_client_id",
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET || "test_microsoft_client_secret",
      callbackURL: `${
        process.env.CORS_ORIGIN || "http://localhost:3000"
      }/api/auth/microsoft/callback`,
      scope: ["user.read"],
      tenant: "common",
    });
  }

  async validate(accessToken: string, refreshToken: string, profile: any): Promise<any> {
    return {
      email: profile.userPrincipalName,
      firstName: profile.name.givenName,
      lastName: profile.name.familyName || "Lastname",
    };
  }
}
