import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy } from "passport-google-oauth20";

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, "google") {
  constructor() {
    super({
      issuer: "https://accounts.google.com",
      authorizationURL: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenURL: "https://oauth2.googleapis.com/token",
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
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
