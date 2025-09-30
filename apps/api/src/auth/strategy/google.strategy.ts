import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy } from "passport-google-oauth20";

import { EnvService } from "src/env/services/env.service";

import type { Request } from "express";
import type { Profile, VerifyCallback } from "passport-google-oauth20";
import type { GoogleUserType } from "src/utils/types/google-user.type";

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
            .catch(() => undefined) ||
            this.configService.get<string>("google_authorization.GOOGLE_CLIENT_ID"),

          this.envService
            .getEnv("GOOGLE_CLIENT_SECRET")
            .then((r) => r.value)
            .catch(() => undefined) ||
            this.configService.get<string>("google_authorization.GOOGLE_CLIENT_SECRET"),
        ]);

        if (!id || !secret) {
          this.fail("Google OAuth not configured", 401);
          return;
        }

        const inner = new Strategy(
          {
            clientID: id,
            clientSecret: secret,
            callbackURL: this.configService.get<string>("google_authorization.callbackURL"),
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

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
  ): Promise<GoogleUserType> {
    type GoogleProfileJson = {
      email?: string;
      given_name?: string;
      family_name?: string;
    };

    const json = profile._json as GoogleProfileJson;

    return {
      email: json.email ?? "",
      firstName: json.given_name ?? "",
      lastName: json.family_name ?? "",
    };
  }
}
