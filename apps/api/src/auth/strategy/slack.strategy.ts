import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import axios from "axios";
import { Strategy } from "passport-oauth2";

import type { ProviderLoginUserType } from "src/utils/types/provider-login-user.type";

@Injectable()
export class SlackStrategy extends PassportStrategy(Strategy, "slack") {
  constructor(private readonly configService: ConfigService) {
    const clientID = configService.get<string>("slack_authorization.SLACK_CLIENT_ID");
    const clientSecret = configService.get<string>("slack_authorization.SLACK_CLIENT_SECRET");

    if (!clientID || !clientSecret) {
      console.error(
        "Slack OAuth credentials are not set. Please check your environment variables.",
      );
    }

    super({
      authorizationURL: "https://slack.com/openid/connect/authorize",
      tokenURL: "https://slack.com/api/openid.connect.token",
      clientID: clientID || "test_slack_client_id",
      clientSecret: clientSecret || "test_slack_client_secret",
      callbackURL: configService.get<string>("slack_authorization.callbackURL"),
      scope: ["openid", "profile", "email"],
    });
  }

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
