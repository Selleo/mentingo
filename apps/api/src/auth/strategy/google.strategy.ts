import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy } from "passport-google-oauth20";

import type { ProviderLoginUserType } from "src/utils/types/provider-login-user.type";

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, "google") {
  constructor(private readonly configService: ConfigService) {
    const clientID = configService.get<string>("google_authorization.GOOGLE_CLIENT_ID");
    const clientSecret = configService.get<string>("google_authorization.GOOGLE_CLIENT_SECRET");

    if (!clientID || !clientSecret) {
      console.error(
        "Google OAuth credentials are not set. Please check your environment variables.",
      );
    }

    super({
      issuer: "https://accounts.google.com",
      authorizationURL: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenURL: "https://oauth2.googleapis.com/token",
      clientID: clientID || "test_google_client_id",
      clientSecret: clientSecret || "test_google_client_secret",
      callbackURL: configService.get<string>("google_authorization.callbackURL"),
      scope: ["email", "profile"],
    });
  }

  async validate(issuer: string, sub: string, profile: any): Promise<ProviderLoginUserType> {
    return {
      email: profile._json.email,
      firstName: profile._json.given_name,
      lastName: profile._json.family_name || "",
    };
  }
}
