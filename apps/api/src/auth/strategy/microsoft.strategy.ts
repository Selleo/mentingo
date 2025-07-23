import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy } from "passport-microsoft";

import type { MicrosoftProfile, MicrosoftUserType } from "src/utils/types/microsoft-user.type";

@Injectable()
export class MicrosoftStrategy extends PassportStrategy(Strategy, "microsoft") {
  constructor(private readonly configService: ConfigService) {
    if (
      !configService.get<string>("microsoft_authorization.MICROSOFT_CLIENT_ID") ||
      !configService.get<string>("microsoft_authorization.MICROSOFT_CLIENT_SECRET")
    ) {
      console.error(
        "Microsoft OAuth credentials are not set. Please check your environment variables.",
      );
    }

    super({
      clientID: configService.get<string>("microsoft_authorization.MICROSOFT_CLIENT_ID"),
      clientSecret: configService.get<string>("microsoft_authorization.MICROSOFT_CLIENT_SECRET"),
      callbackURL: configService.get<string>("microsoft_authorization.callbackURL"),
      scope: ["user.read"],
      tenant: "common",
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: MicrosoftProfile,
  ): Promise<MicrosoftUserType> {
    return {
      email: profile.userPrincipalName,
      firstName: profile.name.givenName,
      lastName: profile.name.familyName || "",
    };
  }
}
