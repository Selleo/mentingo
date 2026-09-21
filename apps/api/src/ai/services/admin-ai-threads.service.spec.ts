import { NotFoundException } from "@nestjs/common";
import { PERMISSIONS, SYSTEM_ROLE_PERMISSIONS, SYSTEM_ROLE_SLUGS } from "@repo/shared";

import { AdminAiThreadsController } from "src/ai/admin-ai-threads.controller";
import { AdminAiThreadsService } from "src/ai/services/admin-ai-threads.service";
import { REQUIRED_PERMISSIONS_KEY } from "src/common/decorators/require-permission.decorator";

import type { AdminAiThreadsRepository } from "src/ai/repositories/admin-ai-threads.repository";
import type { FileService } from "src/file/file.service";

describe("Admin AI conversations", () => {
  const adminAiThreadsRepository = {
    findThreadSummaryById: jest.fn(),
    getThreadSummaries: jest.fn(),
    findThreadJudgementByThreadId: jest.fn(),
    getThreadJudgementCriteria: jest.fn(),
    getThreadJudgementBlockingErrors: jest.fn(),
    getThreadMessages: jest.fn(),
  };
  const fileService = { getFileUrl: jest.fn() };
  const adminAiThreadsService = new AdminAiThreadsService(
    adminAiThreadsRepository as unknown as AdminAiThreadsRepository,
    fileService as unknown as FileService,
  );
  const owner = { id: "owner", firstName: "First", lastName: "Last", avatarReference: null };

  beforeEach(() => jest.resetAllMocks());

  it("protects every read route with the Admin-only permission", () => {
    for (const method of [
      "getAdminAiThreadSummaries",
      "getAdminAiThreadDetails",
      "getAdminAiThreadMessages",
    ] as const) {
      expect(
        Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, AdminAiThreadsController.prototype[method]),
      ).toEqual([PERMISSIONS.AI_THREAD_READ]);
    }
    const roles = Object.entries(SYSTEM_ROLE_PERMISSIONS)
      .filter(([, permissions]) => permissions.includes(PERMISSIONS.AI_THREAD_READ))
      .map(([role]) => role);
    expect(roles).toEqual([SYSTEM_ROLE_SLUGS.ADMIN]);
  });

  it("rejects reversed and empty date intervals before querying", async () => {
    await expect(
      adminAiThreadsService.getThreadSummaries({
        from: "2026-09-10T00:00:00Z",
        to: "2026-09-09T00:00:00Z",
      }),
    ).rejects.toThrow("aiConversations.errors.invalidDateRange");
    await expect(
      adminAiThreadsService.getThreadSummaries({
        from: "2026-09-10T00:00:00Z",
        to: "2026-09-10T00:00:00Z",
      }),
    ).rejects.toThrow("aiConversations.errors.invalidDateRange");
    expect(adminAiThreadsRepository.getThreadSummaries).not.toHaveBeenCalled();
  });

  it("does not expose evaluation or messages when a thread is absent from tenant scope", async () => {
    adminAiThreadsRepository.findThreadSummaryById.mockResolvedValue(undefined);
    await expect(adminAiThreadsService.getThread("other-tenant-thread")).rejects.toThrow(
      NotFoundException,
    );
    await expect(
      adminAiThreadsService.getThreadMessages("other-tenant-thread", {}),
    ).rejects.toThrow(NotFoundException);
    expect(adminAiThreadsRepository.findThreadJudgementByThreadId).not.toHaveBeenCalled();
    expect(adminAiThreadsRepository.getThreadMessages).not.toHaveBeenCalled();
  });

  it("reads the selected archived attempt's saved result without source initialization", async () => {
    adminAiThreadsRepository.findThreadSummaryById.mockResolvedValue({
      id: "old-attempt",
      status: "archived",
      owner,
    });
    adminAiThreadsRepository.findThreadJudgementByThreadId.mockResolvedValue({
      id: "saved-judgement",
      passed: true,
      earnedPoints: 4,
      maxScore: 5,
      percentage: 80,
    });
    adminAiThreadsRepository.getThreadJudgementCriteria.mockResolvedValue([]);
    adminAiThreadsRepository.getThreadJudgementBlockingErrors.mockResolvedValue([]);
    expect(await adminAiThreadsService.getThread("old-attempt", { language: "en" })).toEqual({
      id: "old-attempt",
      status: "archived",
      owner: { id: "owner", firstName: "First", lastName: "Last", profilePictureUrl: null },
      evaluation: {
        passed: true,
        score: 4,
        maxScore: 5,
        percentage: 80,
        criteria: [],
        blockingErrors: [],
      },
    });
    expect(adminAiThreadsRepository.findThreadJudgementByThreadId).toHaveBeenCalledWith(
      "old-attempt",
    );
    expect(adminAiThreadsRepository.getThreadJudgementCriteria).toHaveBeenCalledWith(
      "saved-judgement",
    );
    expect(adminAiThreadsRepository.getThreadJudgementBlockingErrors).toHaveBeenCalledWith(
      "saved-judgement",
    );
  });

  it("resolves shared avatar references once per page and omits storage keys", async () => {
    adminAiThreadsRepository.getThreadSummaries.mockResolvedValue({
      data: [1, 2].map((id) => ({ id, owner: { ...owner, avatarReference: "avatars/owner" } })),
      pagination: { page: 1, perPage: 20, totalItems: 2 },
    });
    fileService.getFileUrl.mockResolvedValue("https://signed-avatar");
    const result = await adminAiThreadsService.getThreadSummaries({});
    expect(fileService.getFileUrl).toHaveBeenCalledTimes(1);
    expect(result.data[0].owner).toEqual({
      id: "owner",
      firstName: "First",
      lastName: "Last",
      profilePictureUrl: "https://signed-avatar",
    });
  });
});
