import { Controller, Get } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { TENANT_STATUSES } from "@repo/shared";
import cors from "cors";
import { PgDialect } from "drizzle-orm/pg-core";
import request from "supertest";

import { Public } from "src/common/decorators/public.decorator";
import { JwtAuthGuard } from "src/common/guards/jwt-auth.guard";
import { createCorsOriginOption } from "src/utils/cors";
import * as redisCache from "src/utils/redis-cache";

import { TenantResolverService } from "./tenant-resolver.service";
import { TenantRlsInterceptor } from "./tenant-rls.interceptor";

import type { INestApplication } from "@nestjs/common";
import type { SQL } from "drizzle-orm";

const handler = jest.fn(() => ({ ok: true }));

@Controller("tenant-probe")
class TenantProbeController {
  @Public()
  @Get("public")
  publicResource() {
    return handler();
  }

  @Get("private")
  privateResource() {
    return handler();
  }
}

describe("Tenant resolution HTTP status", () => {
  let app: INestApplication;
  let tenantResolverService: TenantResolverService;
  const knownId = "ca8de1a4-cc78-42b1-a48f-9ea78469315f";
  const inactiveId = "ca8de1a4-cc78-42b1-a48f-9ea784693160";
  const tenant = { id: knownId, host: "https://known.example", status: TENANT_STATUSES.ACTIVE };
  const inactive = {
    id: inactiveId,
    host: "https://inactive.example",
    status: TENANT_STATUSES.INACTIVE,
  };
  const dialect = new PgDialect();

  beforeAll(async () => {
    const dbQuery = {
      from: () => dbQuery,
      where: (condition: SQL) => ({
        limit: async () => {
          const value = dialect.sqlToQuery(condition).params[0];
          if (value === tenant.id || value === tenant.host) return [tenant];
          if (value === inactive.id || value === inactive.host) return [inactive];
          return [];
        },
      }),
    };
    tenantResolverService = new TenantResolverService(
      { select: () => dbQuery } as never,
      { verify: async () => null } as never,
    );
    const jwtService = {
      verifyAsync: async (token: string) => {
        if (token === "valid") return { userId: "user-1", tenantId: knownId };
        if (token === "deleted-tenant")
          return { userId: "user-1", tenantId: "ca8de1a4-cc78-42b1-a48f-9ea784693199" };
        throw new Error("invalid JWT");
      },
    };
    const module = await Test.createTestingModule({
      controllers: [TenantProbeController],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix("api");
    jest.spyOn(redisCache, "getCachedJson").mockResolvedValue([tenant.host, inactive.host]);
    app.use(cors({ origin: createCorsOriginOption({} as never), credentials: true }));
    app.useGlobalGuards(
      new JwtAuthGuard(
        jwtService as never,
        new Reflector(),
        new ConfigService({ jwt: { secret: "test-secret" } }),
        { isUserRevoked: async () => false } as never,
        {} as never,
        tenantResolverService,
      ),
    );
    app.useGlobalInterceptors(
      new TenantRlsInterceptor(
        {
          runWithTenantContext: async (_tenantId: string, callback: () => unknown) => callback(),
        } as never,
        tenantResolverService,
      ),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    jest.restoreAllMocks();
  });
  beforeEach(() => {
    handler.mockClear();
  });

  it.each(["public", "private"])(
    "returns a generic404 for an unknown host on a %s endpoint",
    async (path) => {
      const response = await request(app.getHttpServer())
        .get(`/api/tenant-probe/${path}`)
        .set("Origin", "https://unknown.example")
        .expect(404);
      expect(response.body).toEqual({
        statusCode: 404,
        message: "tenant.error.notFound",
        error: "Not Found",
      });
      expect(JSON.stringify(response.body)).not.toContain("unknown.example");
      expect(response.headers["access-control-allow-origin"]).toBeUndefined();
      expect(handler).not.toHaveBeenCalled();
    },
  );

  it.each(["public", "private"])(
    "returns404 for unknown same-origin Referer on a %s endpoint",
    async (path) => {
      const response = await request(app.getHttpServer())
        .get(`/api/tenant-probe/${path}`)
        .set("Referer", "https://unknown.example/")
        .expect(404);
      expect(response.body.message).toBe("tenant.error.notFound");
      expect(handler).not.toHaveBeenCalled();
    },
  );

  it("keeps unauthenticated requests on an existing tenant at401", async () => {
    await request(app.getHttpServer())
      .get("/api/tenant-probe/private")
      .set("Origin", tenant.host)
      .expect(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it("keeps the authentication failure at401 for an existing inactive tenant", async () => {
    await request(app.getHttpServer())
      .get("/api/tenant-probe/private")
      .set("Origin", inactive.host)
      .expect(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it.each([
    ["https://unknown.example", 404],
    [tenant.host, 401],
  ] as const)(
    "distinguishes invalid authentication from tenant lookup at%s",
    async (origin, status) => {
      await request(app.getHttpServer())
        .get("/api/tenant-probe/private")
        .set("Origin", origin)
        .set("Authorization", "Bearer invalid")
        .expect(status);
      expect(handler).not.toHaveBeenCalled();
    },
  );

  it("serves an anonymous public resource only for an existing active tenant", async () => {
    await request(app.getHttpServer())
      .get("/api/tenant-probe/public")
      .set("Origin", tenant.host)
      .expect(200);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("keeps inactive tenant resource access forbidden", async () => {
    await request(app.getHttpServer())
      .get("/api/tenant-probe/public")
      .set("Origin", inactive.host)
      .expect(403);
    expect(handler).not.toHaveBeenCalled();
  });

  it("returns404 when an otherwise authenticated token references a deleted tenant", async () => {
    await request(app.getHttpServer())
      .get("/api/tenant-probe/private")
      .set("Origin", tenant.host)
      .set("Authorization", "Bearer deleted-tenant")
      .expect(404);
    expect(handler).not.toHaveBeenCalled();
  });

  it("preserves normal authenticated tenant access", async () => {
    await request(app.getHttpServer())
      .get("/api/tenant-probe/private")
      .set("Origin", tenant.host)
      .set("Authorization", "Bearer valid")
      .expect(200);
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
