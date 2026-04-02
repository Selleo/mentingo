import {
  Injectable,
  type CanActivate,
  type ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";

import { SessionRevocationService } from "src/redis";
import { extractToken } from "src/utils/extract-token";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private reflector: Reflector,
    private configService: ConfigService,
    private readonly sessionRevocationService: SessionRevocationService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>("isPublic", [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest();
    const token = extractToken(request, "access_token");

    if (isPublic) {
      // For public endpoints, try to populate user if token exists, but don't fail if missing
      if (token) {
        try {
          const payload = await this.jwtService.verifyAsync(token, {
            secret: this.configService.get<string>("jwt.secret"),
          });

          const isRevoked = await this.sessionRevocationService.isUserRevoked(payload.userId);

          request["user"] = isRevoked ? null : payload;
        } catch {
          // Silently ignore invalid tokens for public endpoints
          request["user"] = null;
        }
      } else {
        request["user"] = null;
      }
      return true;
    }

    // For protected endpoints, require valid token
    if (!token) {
      throw new UnauthorizedException("Access token not found");
    }

    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get<string>("jwt.secret"),
      });

      if (
        payload.isSupportMode &&
        payload.supportExpiresAt &&
        new Date(payload.supportExpiresAt).getTime() <= Date.now()
      ) {
        throw new UnauthorizedException("supportMode.errors.sessionExpired");
      }

      const isRevoked = await this.sessionRevocationService.isUserRevoked(payload.userId);

      if (isRevoked) throw new UnauthorizedException("auth.error.sessionRevoked");

      request["user"] = payload;

      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;

      throw new UnauthorizedException("Invalid access token");
    }
  }
}
