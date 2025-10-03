import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy } from "passport-google-oauth20";

import { EnvService } from "src/env/services/env.service";

import type { Request } from "express";
import type { Profile, VerifyCallback } from "passport-google-oauth20";
import type { ProviderLoginUserType } from "src/utils/types/provider-login-user.type";

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, "google") {
  constructor(
    private readonly configService: ConfigService,
    private readonly envService: EnvService,
  ) {
    super({
      clientID: "placeholder",
      clientSecret: "placeholder",
      callbackURL: configService.get<string>("google_authorization.callbackURL"),
      scope: ["email", "profile"],
    });
  }

  authenticate(req: Request, options?: unknown): void {
    (async () => {
      try {
        const [id, secret] = await Promise.all([
          this.envService
            .getEnv("GOOGLE_CLIENT_ID")
            .then((r) => r.value)
            .catch(() => this.configService.get<string>("google_authorization.GOOGLE_CLIENT_ID")),

          this.envService
            .getEnv("GOOGLE_CLIENT_SECRET")
            .then((r) => r.value)
            .catch(() =>
              this.configService.get<string>("google_authorization.GOOGLE_CLIENT_SECRET"),
            ),
        ]);

        if (!id || !secret) {
          this.fail("Google OAuth not configured", 401);
          return;
        }

        const inner = new Strategy(
          {
            clientID: id,
            clientSecret: secret,
            callbackURL: "http://localhost:5173/api/auth/google/callback",
            scope: ["email", "profile"],
          },
          (accessToken: string, refreshToken: string, profile: Profile, done: VerifyCallback) =>
            Promise.resolve(this.validate(accessToken, refreshToken, profile)).then(
              (u) => done(null, u),
              done,
            ),
        );

        inner.success = this.success.bind(this);
        inner.fail = this.fail.bind(this);
        inner.error = this.error.bind(this);
        inner.redirect = this.redirect.bind(this);
        inner.pass = this.pass.bind(this);

        inner.authenticate(req as any, options as any);
      } catch (err) {
        this.error(err);
      }
    })();
  }

  async validate(issuer: string, sub: string, profile: any): Promise<ProviderLoginUserType> {
    return {
      email: profile._json.email,
      firstName: profile._json.given_name,
      lastName: profile._json.family_name || "",
    };
  }
}
