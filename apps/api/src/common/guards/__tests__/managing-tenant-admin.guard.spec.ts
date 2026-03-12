import { ForbiddenException, UnauthorizedException } from "@nestjs/common";

import { PERMISSIONS } from "src/permission/permission.constants";

import { ManagingTenantAdminGuard } from "../managing-tenant-admin.guard";

import type { ExecutionContext } from "@nestjs/common";

const createContext = (user?: Record<string, unknown>): ExecutionContext =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  }) as ExecutionContext;

const createDbMock = (isManaging: boolean | null) => ({
  select: jest.fn(() => ({
    from: jest.fn(() => ({
      where: jest.fn(() => ({
        limit: jest.fn(async () => (isManaging === null ? [] : [{ isManaging }])),
      })),
    })),
  })),
});

describe("ManagingTenantAdminGuard", () => {
  it("throws unauthorized when user is missing", async () => {
    const guard = new ManagingTenantAdminGuard(createDbMock(true) as any);

    await expect(guard.canActivate(createContext())).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("throws forbidden when permission context is missing", async () => {
    const guard = new ManagingTenantAdminGuard(createDbMock(true) as any);
    const context = createContext({ tenantId: "tenant-id" });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("throws forbidden when tenant-manage permission is missing", async () => {
    const guard = new ManagingTenantAdminGuard(createDbMock(true) as any);
    const context = createContext({ tenantId: "tenant-id", permissions: [] });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("throws forbidden when tenant is not managing", async () => {
    const guard = new ManagingTenantAdminGuard(createDbMock(false) as any);
    const context = createContext({
      tenantId: "tenant-id",
      permissions: [PERMISSIONS.TENANT_MANAGE],
    });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("allows request when user has tenant-manage permission and tenant is managing", async () => {
    const guard = new ManagingTenantAdminGuard(createDbMock(true) as any);
    const context = createContext({
      tenantId: "tenant-id",
      permissions: [PERMISSIONS.TENANT_MANAGE],
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });
});
