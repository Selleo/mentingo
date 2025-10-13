import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy } from "passport-microsoft";

import { EnvService } from "src/env/services/env.service";

import type { Request } from "express";
import type { MicrosoftProfile } from "src/utils/types/microsoft-auth.type";
import type { ProviderLoginUserType } from "src/utils/types/provider-login-user.type";

@Injectable()
export class MicrosoftStrategy extends PassportStrategy(Strategy, "microsoft") {
  constructor(
    private readonly configService: ConfigService,
    private readonly envService: EnvService,
  ) {
    super({
      clientID: "placeholder",
      clientSecret: "placeholder",
      callbackURL: configService.get<string>("callback_url.MICROSOFT"),
      scope: ["user.read"],
      tenant: "common",
    });
  }

  authenticate(req: Request, options?: unknown): void {
    (async () => {
      try {
        const [id, secret] = await Promise.all([
          this.envService
            .getEnv("MICROSOFT_CLIENT_ID")
            .then((r) => r.value)
            .catch(() =>
              this.configService.get<string>("microsoft_authorization.MICROSOFT_CLIENT_ID"),
            ),
          this.envService
            .getEnv("MICROSOFT_CLIENT_SECRET")
            .then((r) => r.value)
            .catch(() =>
              this.configService.get<string>("microsoft_authorization.MICROSOFT_CLIENT_SECRET"),
            ),
        ]);

        if (!id || !secret) {
          this.fail("Microsoft OAuth not configured", 401);
          return;
        }

        const inner = new Strategy(
          {
            clientID: id,
            clientSecret: secret,
            callbackURL: this.configService.get<string>("callback_url.MICROSOFT"),
            scope: ["user.read"],
            tenant: "common",
          },
          (
            accessToken: string,
            refreshToken: string,
            profile: MicrosoftProfile,
            done: (err: any, user?: any, info?: any) => void,
          ) =>
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
        this.error(err as Error);
      }
    })();
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: MicrosoftProfile,
  ): Promise<ProviderLoginUserType> {
    return {
      email: profile.userPrincipalName,
      firstName: profile.name.givenName,
      lastName: profile.name.familyName || "",
    };
  }
}
