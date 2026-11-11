import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { AUTH_TOKEN_PURPOSE } from "@repo/shared";
import { ExtractJwt, Strategy } from "passport-jwt";

import { SessionService } from "../session/session.service";

import type { JwtPayload } from "../schemas/jwt-strategy.schema";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private readonly sessionService: SessionService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (request) => request?.cookies?.access_token,
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>("jwt.secret"),
    });
  }

  async validate(payload: JwtPayload) {
    return this.sessionService.validateSessionClaims(payload, AUTH_TOKEN_PURPOSE.ACCESS);
  }
}
