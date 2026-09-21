import { ForbiddenException, UnauthorizedException, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PERMISSIONS } from "@repo/shared";

import { PermissionsGuard } from "src/common/guards/permissions.guard";

import { IntegrationApiKeyGuard } from "./guards/integration-api-key.guard";
import { IntegrationController } from "./integration.controller";

import type { IntegrationService } from "./integration.service";
import type { IntegrationRequest } from "./integration.types";

jest.mock("./integration.service", () => ({ IntegrationService: class {} }));
jest.mock("src/user/user.service", () => ({ UserService: class {} }));
jest.mock("src/group/group.service", () => ({ GroupService: class {} }));
jest.mock("src/courses/course.service", () => ({ CourseService: class {} }));

describe("IntegrationController.updateTenantApiKeys", () => {
  const tenantId = "00000000-0000-4000-8000-000000000001";
  const keyTenantId = "00000000-0000-4000-8000-000000000002";

  function setup(headers: Record<string, string> = { "x-api-key": "test-integration-key" }) {
    const user = {
      userId: "00000000-0000-4000-8000-000000000003",
      email: "operator@example.test",
      roleSlugs: [],
      permissions: [PERMISSIONS.INTEGRATION_API_USE, PERMISSIONS.TENANT_MANAGE],
      tenantId: keyTenantId,
    };
    const authenticateApiKey = jest
      .fn()
      .mockResolvedValue({ user, keyId: "key-id", keyTenantId, keyTenantIsManaging: true });
    const updateTenantApiKeysForIntegration = jest
      .fn()
      .mockResolvedValue({ tenantId, updatedKeys: ["LUMA_API_KEY"] });
    const service = {
      authenticateApiKey,
      markKeyAsUsed: jest.fn(),
      updateTenantApiKeysForIntegration,
    } as unknown as IntegrationService;
    const request = { headers } as IntegrationRequest;
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => IntegrationController.prototype.updateTenantApiKeys,
      getClass: () => IntegrationController,
    } as unknown as ExecutionContext;
    const reflector = new Reflector();
    return {
      user,
      request,
      context,
      authenticateApiKey,
      updateTenantApiKeysForIntegration,
      guard: new IntegrationApiKeyGuard(service, reflector),
      permissionsGuard: new PermissionsGuard(reflector),
      controller: new IntegrationController(
        service,
        undefined as never,
        undefined as never,
        undefined as never,
      ),
    };
  }

  it("accepts the integration key without X-Tenant-Id and returns the response envelope", async () => {
    const {
      guard,
      permissionsGuard,
      context,
      controller,
      user,
      updateTenantApiKeysForIntegration,
    } = setup();
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(permissionsGuard.canActivate(context)).toBe(true);
    const body = { name: "LUMA_API_KEY", value: "test-luma-key" };
    const keyTenant = { tenantId: keyTenantId, isManaging: true };
    await expect(controller.updateTenantApiKeys(tenantId, body, user, keyTenant)).resolves.toEqual({
      data: { tenantId, updatedKeys: ["LUMA_API_KEY"] },
    });
    expect(updateTenantApiKeysForIntegration).toHaveBeenCalledWith(tenantId, body, user, keyTenant);
  });

  it("rejects a missing credential before authentication", async () => {
    const { guard, context, authenticateApiKey } = setup({});
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(authenticateApiKey).not.toHaveBeenCalled();
  });

  it("rejects an invalid credential", async () => {
    const { guard, context, authenticateApiKey } = setup();
    authenticateApiKey.mockRejectedValue(new UnauthorizedException());
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("requires integration permission from the authenticated owner", async () => {
    const { guard, permissionsGuard, context, user } = setup();
    user.permissions = [PERMISSIONS.TENANT_MANAGE];
    await guard.canActivate(context);
    expect(() => permissionsGuard.canActivate(context)).toThrow(ForbiddenException);
  });

  it("preserves the real managing key owner when a target header is supplied", async () => {
    const { guard, context, request } = setup({
      "x-api-key": "test-integration-key",
      "x-tenant-id": tenantId,
    });
    await guard.canActivate(context);
    expect(request.user?.tenantId).toBe(tenantId);
    expect(request.integrationKeyTenantId).toBe(keyTenantId);
    expect(request.integrationKeyTenantIsManaging).toBe(true);
  });

  it("rejects a non-managing key trying to impersonate the managing tenant via a header", async () => {
    const { guard, context, authenticateApiKey, user } = setup({
      "x-api-key": "test-integration-key",
      "x-tenant-id": keyTenantId,
    });
    authenticateApiKey.mockResolvedValue({
      user,
      keyId: "key-id",
      keyTenantId: tenantId,
      keyTenantIsManaging: false,
    });
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
