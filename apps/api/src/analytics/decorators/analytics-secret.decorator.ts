import {
  ForbiddenException,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";

import { getSecret } from "src/analytics/utils/getSecret";

import type { Request } from "express";

@Injectable()
export class AnalyticsSecretGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const secret = getSecret(request);
    const expectedSecret = process.env.ANALYTICS_SECRET;

    if (!expectedSecret || expectedSecret !== secret) {
      throw new ForbiddenException("Invalid API Secret");
    }

    return true;
  }
}
