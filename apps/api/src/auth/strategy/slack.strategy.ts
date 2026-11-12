import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import axios from "axios";
import { Strategy } from "passport-oauth2";

import { OAUTH_LOGIN_ERROR_KEYS } from "src/auth/oauth/oauth-login.constants";
import { OAuthLoginException } from "src/auth/oauth/oauth-login.exception";
import { getCallbackPath } from "src/common/configuration/callbackUrl";
import { EnvService } from "src/env/services/env.service";

import type { Request } from "express";
import type { VerifyCallback } from "passport-oauth2";
import type { ProviderLoginUserType } from "src/utils/types/provider-login-user.type";

type SlackUserInfoResponse = {
  ok: boolean;
  error?: string;
  email?: string;
  name?: string;
  given_name?: string;
  family_name?: string;
};

@Injectable()
export class SlackStrategy extends PassportStrategy(Strategy, "slack") {
  private readonly logger = new Logger(SlackStrategy.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly envService: EnvService,
  ) {
    super({
      authorizationURL: "https://slack.com/openid/connect/authorize",
      tokenURL: "https://slack.com/api/openid.connect.token",
      clientID: "test_slack_client_id",
      clientSecret: "test_slack_client_secret",
      callbackURL: getCallbackPath("slack"),
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
          this.error(new OAuthLoginException(OAUTH_LOGIN_ERROR_KEYS.PROVIDER_NOT_CONFIGURED));
          return;
        }

        const inner = new Strategy(
          {
            authorizationURL: "https://slack.com/openid/connect/authorize",
            tokenURL: "https://slack.com/api/openid.connect.token",
            clientID: id,
            clientSecret: secret,
            callbackURL: getCallbackPath("slack"),
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
        inner.error = (error: Error) => this.error(this.toOAuthLoginException(error));
        inner.redirect = this.redirect.bind(this);
        inner.pass = this.pass.bind(this);

        inner.authenticate(req as any, options as any);
      } catch (err) {
        this.error(err);
      }
    })();
  }

  private toOAuthLoginException(error: Error) {
    if (error instanceof OAuthLoginException) return error;

    this.logger.warn(`Slack OAuth failed: ${error.message}`);
    return new OAuthLoginException(OAUTH_LOGIN_ERROR_KEYS.PROVIDER_ERROR);
  }

  async validate(accessToken: string): Promise<ProviderLoginUserType> {
    const { data: userInfo } = await axios.get<SlackUserInfoResponse>(
      "https://slack.com/api/openid.connect.userInfo",
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    if (!userInfo.ok || !userInfo.email) {
      this.logger.warn(
        `Slack user info request failed: ${userInfo.error ?? "response has no email"}`,
      );
      throw new OAuthLoginException(OAUTH_LOGIN_ERROR_KEYS.PROVIDER_ERROR);
    }

    return {
      firstName: userInfo.given_name ?? userInfo.name ?? "",
      lastName: userInfo.family_name ?? "",
      email: userInfo.email,
    };
  }
}
