import {
  Injectable,
  type CanActivate,
  type ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from "@nestjs/common";
import { AUTH_TOKEN_PURPOSE } from "@repo/shared";

import { SessionService } from "src/auth/session/session.service";
import { extractToken } from "src/utils/extract-token";

@Injectable()
export class RefreshTokenGuard implements CanActivate {
  constructor(private readonly sessionService: SessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const refreshToken = extractToken(request, "refresh_token");

    if (!refreshToken) {
      throw new UnauthorizedException("No refresh token provided");
    }

    try {
      const payload = await this.sessionService.verifySessionToken(
        refreshToken,
        AUTH_TOKEN_PURPOSE.REFRESH,
      );

      request["user"] = payload;
      request["refreshToken"] = refreshToken;

      return true;
    } catch {
      throw new ForbiddenException("Invalid refresh token");
    }
  }
}
