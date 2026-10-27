import { NotFoundException, UnauthorizedException } from "@nestjs/common";

import { TenantResolverService } from "./tenant-resolver.service";

import type { Request } from "express";

describe("TenantResolverService OAuth state", () => {
  const callback = {
    path: "/api/auth/google/callback",
    query: { state: "signed-state" },
    headers: {},
    method: "GET",
  } as unknown as Request;
  const limit = jest.fn().mockResolvedValue([]);
  const db = { select: () => ({ from: () => ({ where: () => ({ limit }) }) }) };

  beforeEach(() => {
    limit.mockClear();
  });

  it("preserves401 for invalid OAuth state without looking up tenant data", async () => {
    const service = new TenantResolverService(db as never, { verify: async () => null } as never);
    await expect(service.resolveTenantId(callback)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(limit).not.toHaveBeenCalled();
  });

  it("returns generic404 for a verified state whose tenant no longer exists", async () => {
    const service = new TenantResolverService(
      db as never,
      { verify: async () => "deleted-tenant" } as never,
    );
    await expect(service.resolveTenantId(callback)).rejects.toEqual(
      new NotFoundException("tenant.error.notFound"),
    );
    expect(limit).toHaveBeenCalledTimes(1);
  });
});
