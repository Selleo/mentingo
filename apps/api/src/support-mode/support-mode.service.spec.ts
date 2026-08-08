import { BadRequestException } from "@nestjs/common";
import { SUPPORT_SESSION_STATUSES, SUPPORT_USER_SCOPES, TENANT_STATUSES } from "@repo/shared";

import { SupportModeService } from "./support-mode.service";

import type { SupportModeRepository } from "./support-mode.repository";
import type { ConfigService } from "@nestjs/config";
import type { FileService } from "src/file/file.service";

const createRepositoryMock = () =>
  ({
    findTenantById: jest.fn(),
    findSupportUserById: jest.fn(),
    findSupportUsers: jest.fn(),
    countSupportUsers: jest.fn(),
    findSupportRoles: jest.fn(),
    revokeOtherActiveSessions: jest.fn(),
    createSupportSession: jest.fn(),
  }) as unknown as jest.Mocked<SupportModeRepository>;

describe("SupportModeService", () => {
  const sourceTenant = {
    id: "source-tenant-id",
    name: "Source",
    host: "https://source.localhost",
    status: TENANT_STATUSES.ACTIVE,
  };
  const targetTenant = {
    id: "target-tenant-id",
    name: "Target",
    host: "https://target.localhost",
    status: TENANT_STATUSES.ACTIVE,
  };
  const currentUser = {
    userId: "source-user-id",
    email: "source@example.com",
    roleSlugs: ["admin"],
    permissions: [],
    tenantId: sourceTenant.id,
  };
  const targetUser = {
    id: "target-user-id",
    email: "target@example.com",
    firstName: "Target",
    lastName: "Admin",
    label: "Target Admin (target@example.com)",
    avatarReference: null,
    roles: [],
  };

  let repository: jest.Mocked<SupportModeRepository>;
  let fileService: jest.Mocked<FileService>;
  let service: SupportModeService;

  beforeEach(() => {
    repository = createRepositoryMock();
    fileService = {
      getFileUrl: jest.fn(async (reference: string) => `https://files.local/${reference}`),
    } as unknown as jest.Mocked<FileService>;
    service = new SupportModeService(
      repository,
      { get: jest.fn(() => "jwt-secret") } as unknown as ConfigService,
      fileService,
    );
  });

  it("requires the target user to be active in the target tenant", async () => {
    repository.findTenantById
      .mockResolvedValueOnce(sourceTenant)
      .mockResolvedValueOnce(targetTenant);
    repository.findSupportUserById.mockResolvedValueOnce(null);

    await expect(
      service.createSupportSession(currentUser, targetTenant.id, targetUser.id),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("stores the selected target user on the support session", async () => {
    repository.findTenantById
      .mockResolvedValueOnce(sourceTenant)
      .mockResolvedValueOnce(targetTenant);
    repository.findSupportUserById.mockResolvedValueOnce(targetUser);

    const result = await service.createSupportSession(currentUser, targetTenant.id, targetUser.id);

    expect(result.redirectUrl).toContain(`${targetTenant.host}/api/auth/support/callback?grant=`);
    expect(repository.createSupportSession).toHaveBeenCalledWith(
      expect.objectContaining({
        originalUserId: currentUser.userId,
        originalTenantId: sourceTenant.id,
        targetTenantId: targetTenant.id,
        targetUserId: targetUser.id,
        returnUrl: `${sourceTenant.host}/super-admin/tenants`,
        status: SUPPORT_SESSION_STATUSES.PENDING,
      }),
    );
  });

  it("returns selector users with backend-generated labels and roles", async () => {
    repository.findTenantById.mockResolvedValueOnce(targetTenant);
    repository.findSupportUsers.mockResolvedValueOnce([
      { ...targetUser, avatarReference: "avatars/target.png" },
    ]);
    repository.countSupportUsers.mockResolvedValueOnce(1);

    const result = await service.listSupportUsers(targetTenant.id, {
      page: 1,
      perPage: 20,
      scope: SUPPORT_USER_SCOPES.ALL,
      roleSlug: "student",
    });

    expect(result.data).toEqual([
      {
        id: targetUser.id,
        email: targetUser.email,
        firstName: targetUser.firstName,
        lastName: targetUser.lastName,
        label: targetUser.label,
        profilePictureUrl: "https://files.local/avatars/target.png",
        roles: [],
      },
    ]);
    expect(result.pagination).toEqual({ totalItems: 1, page: 1, perPage: 20 });
    expect(repository.findSupportUsers).toHaveBeenCalledWith({
      tenantId: targetTenant.id,
      page: 1,
      perPage: 20,
      search: undefined,
      scope: SUPPORT_USER_SCOPES.ALL,
      roleSlug: "student",
    });
  });
});
