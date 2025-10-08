import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import axios from "axios";
import { Strategy } from "passport-oauth2";

import { EnvService } from "src/env/services/env.service";

import type { Request } from "express";
import type { VerifyCallback } from "passport-oauth2";
import type { ProviderLoginUserType } from "src/utils/types/provider-login-user.type";

@Injectable()
export class SlackStrategy extends PassportStrategy(Strategy, "slack") {
  constructor(
    private readonly configService: ConfigService,
    private readonly envService: EnvService,
  ) {
    super({
      authorizationURL: "https://slack.com/openid/connect/authorize",
      tokenURL: "https://slack.com/api/openid.connect.token",
      clientID: "test_slack_client_id",
      clientSecret: "test_slack_client_secret",
      callbackURL: configService.get<string>("slack_authorization.callbackURL"),
      scope: ["openid", "profile", "email"],
    });
  }

  authenticate(req: Request, options?: any): void {
    (async () => {
      try {
        const [id, secret] = await Promise.all([
          this.envService
            .getEnv("SLACK_CLIENT_ID")
            .then((r) => r.value)
            .catch(() => this.configService.get<string>("slack_authorization.SLACK_CLIENT_ID")),

          this.envService
            .getEnv("SLACK_CLIENT_SECRET")
            .then((r) => r.value)
            .catch(() => this.configService.get<string>("slack_authorization.SLACK_CLIENT_SECRET")),
        ]);

        if (!id || !secret) {
          this.fail("Slack OAuth not configured", 401);
          return;
        }

        const inner = new Strategy(
          {
            authorizationURL: "https://slack.com/openid/connect/authorize",
            tokenURL: "https://slack.com/api/openid.connect.token",
            clientID: id,
            clientSecret: secret,
            callbackURL: this.configService.get<string>("slack_authorization.callbackURL"),
            scope: ["openid", "profile", "email"],
          },
          async (accessToken: string, refreshToken: string, profile: any, done: VerifyCallback) => {
            try {
              const user = await this.validate(accessToken);
              done(null, user);
            } catch (err) {
              done(err);
            }
          },
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

  // super({
  //   authorizationURL: "https://slack.com/openid/connect/authorize",
  //   tokenURL: "https://slack.com/api/openid.connect.token",
  //   clientID: clientID || "test_slack_client_id",
  //   clientSecret: clientSecret || "test_slack_client_secret",
  //   callbackURL: configService.get<string>("slack_authorization.callbackURL"),
  //   scope: ["openid", "profile", "email"],
  // });
  async validate(accessToken: string): Promise<ProviderLoginUserType> {
    const response = await axios.get("https://slack.com/api/users.identity", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const user = response.data.user;

    return {
      firstName: user.name,
      lastName: "",
      email: user.email,
    };
  }
}
