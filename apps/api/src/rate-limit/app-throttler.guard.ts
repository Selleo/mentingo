import { createHash } from "node:crypto";

import { HttpException, HttpStatus, Injectable } from "@nestjs/common";
import {
  ThrottlerGuard,
  type ThrottlerLimitDetail,
  type ThrottlerRequest,
} from "@nestjs/throttler";

import { isRateLimitingDisabled, normalizePath, resolveRateLimitPolicy } from "./rate-limit.utils";

import type { ExecutionContext } from "@nestjs/common";

@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected async handleRequest(request: ThrottlerRequest): Promise<boolean> {
    if (isRateLimitingDisabled()) return true;

    const { req } = this.getRequestResponse(request.context);

    const method = String(req.method || "GET").toUpperCase();
    const rawPath = normalizePath(String(req.originalUrl ?? req.url ?? "/"));

    const policy = resolveRateLimitPolicy(method, rawPath);

    if (!policy) return true;

    return super.handleRequest({
      ...request,
      limit: policy.limit,
      ttl: policy.windowSec * 1000,
      blockDuration: policy.windowSec * 1000,
    });
  }

  protected async getTracker(req: Record<string, any>): Promise<string> {
    const path = normalizePath(String(req.originalUrl ?? req.url ?? "/"));

    if (path.startsWith("/api/auth")) {
      const email = req.body?.email;

      if (typeof email === "string" && email.trim().length > 0) {
        return `email:${email.trim().toLowerCase()}`;
      }
    }

    if (path.startsWith("/api/integration")) {
      const apiKey = this.getHeaderValue(req.headers?.["x-api-key"]);

      if (apiKey) {
        const apiKeyHash = createHash("sha256").update(apiKey).digest("hex").slice(0, 16);
        return `integration-key:${apiKeyHash}`;
      }
    }

    const userId = req.user?.userId;
    if (typeof userId === "string" && userId.length > 0) {
      return `user:${userId}`;
    }

    const forwardedFor = this.getHeaderValue(req.headers?.["x-forwarded-for"]);
    if (forwardedFor) {
      return `ip:${forwardedFor.split(",")[0].trim().toLowerCase()}`;
    }

    return `ip:${String(req.ip ?? req.socket?.remoteAddress ?? "unknown").toLowerCase()}`;
  }

  protected async throwThrottlingException(
    _context: ExecutionContext,
    throttlerLimitDetail: ThrottlerLimitDetail,
  ): Promise<void> {
    const retryAfterSeconds = Math.max(
      1,
      throttlerLimitDetail.timeToBlockExpire || throttlerLimitDetail.timeToExpire || 1,
    );

    throw new HttpException(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        message: "common.toast.tooManyRequests",
        retryAfterSeconds,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  private getHeaderValue(header: unknown): string | null {
    if (Array.isArray(header)) {
      return typeof header[0] === "string" && header[0].length > 0 ? header[0] : null;
    }

    return typeof header === "string" && header.length > 0 ? header : null;
  }
}
