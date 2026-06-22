import { BadRequestException } from "@nestjs/common";
import { SUPPORT_SESSION_STATUSES, TENANT_STATUSES } from "@repo/shared";

import { SupportModeService } from "./support-mode.service";

import type { SupportModeRepository } from "./support-mode.repository";
import type { ConfigService } from "@nestjs/config";
import type { FileService } from "src/file/file.service";

const createRepositoryMock = () =>
  ({
    findTenantById: jest.fn(),
    findSupportAdminUserById: jest.fn(),
    findSupportAdminUsers: jest.fn(),
    countSupportAdminUsers: jest.fn(),
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
  const targetAdmin = {
    id: "target-user-id",
    email: "target@example.com",
    firstName: "Target",
    lastName: "Admin",
    label: "Target Admin (target@example.com)",
    avatarReference: null,
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

  it("requires the target user to be an active admin in the target tenant", async () => {
    repository.findTenantById
      .mockResolvedValueOnce(sourceTenant)
      .mockResolvedValueOnce(targetTenant);
    repository.findSupportAdminUserById.mockResolvedValueOnce(null);

    await expect(
      service.createSupportSession(currentUser, targetTenant.id, targetAdmin.id),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("stores the selected target admin user on the support session", async () => {
    repository.findTenantById
      .mockResolvedValueOnce(sourceTenant)
      .mockResolvedValueOnce(targetTenant);
    repository.findSupportAdminUserById.mockResolvedValueOnce(targetAdmin);

    const result = await service.createSupportSession(currentUser, targetTenant.id, targetAdmin.id);

    expect(result.redirectUrl).toContain(`${targetTenant.host}/api/auth/support/callback?grant=`);
    expect(repository.createSupportSession).toHaveBeenCalledWith(
      expect.objectContaining({
        originalUserId: currentUser.userId,
        originalTenantId: sourceTenant.id,
        targetTenantId: targetTenant.id,
        targetUserId: targetAdmin.id,
        returnUrl: `${sourceTenant.host}/super-admin/tenants`,
        status: SUPPORT_SESSION_STATUSES.PENDING,
      }),
    );
  });

  it("returns selector users with backend-generated labels", async () => {
    repository.findSupportAdminUsers.mockResolvedValueOnce([
      { ...targetAdmin, avatarReference: "avatars/target.png" },
    ]);
    repository.countSupportAdminUsers.mockResolvedValueOnce(1);

    const result = await service.listSupportAdminUsers(targetTenant.id, {
      page: 1,
      perPage: 20,
    });

    expect(result.data).toEqual([
      {
        id: targetAdmin.id,
        email: targetAdmin.email,
        firstName: targetAdmin.firstName,
        lastName: targetAdmin.lastName,
        label: targetAdmin.label,
        profilePictureUrl: "https://files.local/avatars/target.png",
      },
    ]);
    expect(result.pagination).toEqual({ totalItems: 1, page: 1, perPage: 20 });
  });
});
