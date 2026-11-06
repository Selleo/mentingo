import { createHash } from "node:crypto";

import { HttpException, HttpStatus, Injectable } from "@nestjs/common";
import {
  ThrottlerGuard,
  type ThrottlerLimitDetail,
  type ThrottlerRequest,
} from "@nestjs/throttler";

import { isRateLimitingDisabled, normalizePath, resolveRateLimitPolicy } from "./rate-limit.utils";

import type { ExecutionContext } from "@nestjs/common";

const AUTH_PATH_PREFIX = "/api/auth/";

@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected async handleRequest(request: ThrottlerRequest): Promise<boolean> {
    if (isRateLimitingDisabled()) return true;

    const { req } = this.getRequestResponse(request.context);

    const method = String(req.method || "GET").toUpperCase();
    const rawPath = normalizePath(String(req.originalUrl ?? req.url ?? "/"));

    const policy = resolveRateLimitPolicy(method, rawPath);

    if (!policy) return true;

    const limitedRequest = {
      ...request,
      limit: policy.limit,
      ttl: policy.windowSec * 1000,
      blockDuration: policy.windowSec * 1000,
    };

    if (this.getAuthEmail(req, rawPath)) {
      await super.handleRequest({
        ...limitedRequest,
        getTracker: async () => this.getIpTracker(req),
      });
    }

    return super.handleRequest(limitedRequest);
  }

  protected async getTracker(req: Record<string, any>): Promise<string> {
    const path = normalizePath(String(req.originalUrl ?? req.url ?? "/"));

    if (path.startsWith(AUTH_PATH_PREFIX)) {
      const email = this.getAuthEmail(req, path);

      return email ? `email:${email}` : this.getIpTracker(req);
    }

    if (path.startsWith("/api/integration")) {
      const apiKey = this.getHeaderValue(req.headers?.["x-api-key"]);

      if (apiKey) {
        const apiKeyHash = createHash("sha256").update(apiKey).digest("hex").slice(0, 16);
        return `integration-key:${apiKeyHash}`;
      }
    }

    const userId = req.user?.userId ?? req.scormGrant?.actor?.userId;
    if (typeof userId === "string" && userId.length > 0) {
      return `user:${userId}`;
    }

    return this.getIpTracker(req);
  }

  private getAuthEmail(req: Record<string, any>, path: string): string | null {
    const email = req.body?.email;

    if (!path.startsWith(AUTH_PATH_PREFIX) || typeof email !== "string") return null;

    return email.trim().toLowerCase() || null;
  }

  private getIpTracker(req: Record<string, any>): string {
    const ip = String(req.ip ?? req.socket?.remoteAddress ?? "unknown").toLowerCase();

    return `ip:${ip.replace(/^::ffff:/, "")}`;
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
