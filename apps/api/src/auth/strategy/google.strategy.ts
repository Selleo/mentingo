import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy } from "passport-google-oauth20";

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, "google") {
  constructor() {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      console.error(
        "Google OAuth credentials are not set. Please check your environment variables.",
      );
    }

    super({
      issuer: "https://accounts.google.com",
      authorizationURL: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenURL: "https://oauth2.googleapis.com/token",
      clientID: process.env.GOOGLE_CLIENT_ID || "test_google_client_id",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "test_google_client_secret",
      callbackURL: `${process.env.CORS_ORIGIN || "http://localhost:3000"}/api/auth/google/callback`,
      scope: ["email", "profile"],
    });
  }

  async validate(
    issuer: string,
    sub: string,
    profile: any,
  ): Promise<{ email: string; name: string; provider: string }> {
    return {
      email: profile._json.email,
      name: profile._json.name || profile._json.given_name,
      provider: "google",
    };
  }
}
