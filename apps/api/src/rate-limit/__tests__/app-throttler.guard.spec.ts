import { HttpException, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import { AppThrottlerGuard } from "../app-throttler.guard";

class AuthController {}
const login = () => undefined;

const contextFor = (request: Record<string, unknown>): ExecutionContext =>
  ({
    getClass: () => AuthController,
    getHandler: () => login,
    switchToHttp: () => ({
      getRequest: () => ({
        method: "POST",
        originalUrl: "/api/auth/login",
        headers: {},
        ...request,
      }),
      getResponse: () => ({ header: jest.fn() }),
    }),
  }) as unknown as ExecutionContext;

describe("authentication rate limits", () => {
  let guard: AppThrottlerGuard;
  const originalDisableRateLimiting = process.env.DISABLE_RATE_LIMITING;

  beforeEach(async () => {
    delete process.env.DISABLE_RATE_LIMITING;
    const counts = new Map<string, number>();
    const storage = {
      increment: jest.fn(async (key: string, _ttl: number, limit: number) => {
        const totalHits = (counts.get(key) ?? 0) + 1;
        counts.set(key, totalHits);
        return { totalHits, timeToExpire: 60, isBlocked: totalHits > limit, timeToBlockExpire: 60 };
      }),
    };
    guard = new AppThrottlerGuard(
      [{ name: "global", ttl: 60000, limit: 100 }],
      storage,
      new Reflector(),
    );
    await guard.onModuleInit();
  });

  afterEach(() => {
    if (originalDisableRateLimiting === undefined) delete process.env.DISABLE_RATE_LIMITING;
    else process.env.DISABLE_RATE_LIMITING = originalDisableRateLimiting;
  });

  it("returns 429 on the sixth login from one IP even when every email is different", async () => {
    for (let i = 0; i < 5; i++) {
      await expect(
        guard.canActivate(contextFor({ ip: "192.0.2.1", body: { email: `user${i}@example.com` } })),
      ).resolves.toBe(true);
    }
    try {
      await guard.canActivate(
        contextFor({ ip: "192.0.2.1", body: { email: "another@example.com" } }),
      );
      throw new Error("Expected rate limiting");
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(429);
      expect((error as HttpException).getResponse()).toMatchObject({ retryAfterSeconds: 60 });
    }
  });

  it("preserves the per-account limit across different IPs and email casing", async () => {
    for (let i = 0; i < 5; i++) {
      await guard.canActivate(
        contextFor({ ip: `192.0.2.${i}`, body: { email: " User@Example.com " } }),
      );
    }
    await expect(
      guard.canActivate(contextFor({ ip: "192.0.2.99", body: { email: "user@example.com" } })),
    ).rejects.toMatchObject({ status: 429 });
  });

  it("does not trust arbitrary forwarded headers or user IDs on login requests", async () => {
    for (let i = 0; i < 5; i++) {
      await guard.canActivate(
        contextFor({
          ip: "192.0.2.1",
          headers: { "x-forwarded-for": `198.51.100.${i}` },
          user: { userId: `user-${i}` },
        }),
      );
    }
    await expect(
      guard.canActivate(
        contextFor({
          ip: "::ffff:192.0.2.1",
          headers: { "x-forwarded-for": "198.51.100.99" },
          user: { userId: "another" },
        }),
      ),
    ).rejects.toMatchObject({ status: 429 });
  });

  it("keeps separate budgets for independent clients and accounts", async () => {
    for (let i = 0; i < 10; i++) {
      await expect(
        guard.canActivate(
          contextFor({ ip: `192.0.2.${i}`, body: { email: `user${i}@example.com` } }),
        ),
      ).resolves.toBe(true);
    }
  });
});
