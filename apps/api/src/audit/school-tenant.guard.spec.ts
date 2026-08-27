import { ForbiddenException, UnauthorizedException } from "@nestjs/common";

import { SchoolTenantGuard } from "./school-tenant.guard";

import type { ExecutionContext } from "@nestjs/common";

const createGuard = (tenantRows: { isManaging: boolean }[], user?: object) => {
  const limit = jest.fn().mockResolvedValue(tenantRows);
  const where = jest.fn().mockReturnValue({ limit });
  const from = jest.fn().mockReturnValue({ where });
  const select = jest.fn().mockReturnValue({ from });
  const guard = new SchoolTenantGuard({ select } as never);
  const context = {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as ExecutionContext;

  return { guard, context };
};

describe("SchoolTenantGuard", () => {
  it("allows school tenants", async () => {
    const { guard, context } = createGuard([{ isManaging: false }], {
      tenantId: "242359db-654d-4af2-93ee-71ac0ddb4d9f",
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it("rejects the managing tenant", async () => {
    const { guard, context } = createGuard([{ isManaging: true }], {
      tenantId: "242359db-654d-4af2-93ee-71ac0ddb4d9f",
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      new ForbiddenException("auditView.errors.schoolTenantRequired"),
    );
  });

  it("rejects unauthenticated requests", async () => {
    const { guard, context } = createGuard([]);

    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException("auth.error.unauthenticated"),
    );
  });
});
