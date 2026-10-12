import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { PERMISSIONS } from "@repo/shared";

import { REPORT_ERRORS } from "./constants/reports.errors";
import { ReportsExportsService } from "./reports-exports.service";

import type { ReportsQueryService } from "./reports-query.service";
import type { ReportsExportsRepository } from "./repositories/reports-exports.repository";
import type { CurrentUserType } from "src/common/types/current-user.type";

const actor: CurrentUserType = {
  userId: "0f36e00a-5944-4f6c-b468-e1c2705a0ec9",
  tenantId: "3f186e0a-5944-4f6c-b468-e1c2705a0ec9",
  email: "reporter@example.com",
  roleSlugs: [],
  permissions: [PERMISSIONS.REPORT_READ],
};

const query = {
  view: "organisation" as const,
  language: "en" as const,
  timezone: "UTC",
  groupIds: [],
  page: 4,
  pageSize: 25,
};

const makeService = (
  exports: Partial<ReportsExportsRepository>,
  queue: { enqueue?: jest.Mock } = {},
  reportsQuery: Partial<ReportsQueryService> = {},
  storage: Record<string, jest.Mock | (() => boolean)> = {},
  permissions: { getUserAccess?: jest.Mock } = {},
) =>
  new ReportsExportsService(
    exports as ReportsExportsRepository,
    queue as never,
    {
      runWithTenant: async (_tenantId: string, callback: () => Promise<unknown>) => callback(),
      runForEachTenant: jest.fn(),
    } as never,
    reportsQuery as ReportsQueryService,
    {
      getUserAccess: jest
        .fn()
        .mockResolvedValue({ permissions: actor.permissions, roleSlugs: actor.roleSlugs }),
      ...permissions,
    } as never,
    {} as never,
    { isConfigured: () => true, ...storage } as never,
  );

describe("ReportsExportsService", () => {
  it("persists a pending export with an unpaginated query and enqueues generation", async () => {
    const record = {
      id: "4b632420-18ee-4c2a-87b4-509ad413a190",
      format: "xlsx",
      status: "pending",
      expiresAt: null,
      failureCode: null,
    };
    const createPending = jest.fn().mockResolvedValue(record);
    const validateReportAccess = jest.fn();
    const getReportAccessFingerprint = jest.fn().mockResolvedValue("current-access");
    const enqueue = jest.fn().mockResolvedValue(undefined);
    const service = makeService(
      { createPending },
      { enqueue },
      { validateReportAccess, getReportAccessFingerprint },
    );

    const result = await service.createExport({ format: "xlsx", language: "en", query }, actor);

    expect(result).toMatchObject({ id: record.id, status: "pending" });
    expect(validateReportAccess).toHaveBeenCalledWith(
      { ...query, language: "en", page: 1, pageSize: 100 },
      actor,
    );
    expect(createPending).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: actor.tenantId,
        actorId: actor.userId,
        accessFingerprint: "current-access",
      }),
    );
    expect(enqueue).toHaveBeenCalledWith(
      "report-export",
      "generate",
      { tenantId: actor.tenantId, exportId: record.id, actorId: actor.userId, action: "generate" },
      expect.objectContaining({ jobId: record.id, attempts: 3 }),
    );
  });

  it("marks a record failed and returns a stable service error when enqueue fails", async () => {
    const record = { id: "4b632420-18ee-4c2a-87b4-509ad413a190", format: "pdf", status: "pending" };
    const markQueueUnavailable = jest.fn();
    const service = makeService(
      { createPending: jest.fn().mockResolvedValue(record), markQueueUnavailable },
      { enqueue: jest.fn().mockRejectedValue(new Error("redis unavailable")) },
      {
        validateReportAccess: jest.fn(),
        getReportAccessFingerprint: jest.fn().mockResolvedValue("fingerprint"),
      },
    );

    await expect(
      service.createExport({ format: "pdf", language: "en", query }, actor),
    ).rejects.toMatchObject({ message: REPORT_ERRORS.EXPORT_QUEUE_UNAVAILABLE });
    expect(markQueueUnavailable).toHaveBeenCalledWith(actor.tenantId, record.id);
  });

  it("hides another user's export before permission checks or storage access", async () => {
    const fingerprint = jest.fn();
    const getFileStream = jest.fn();
    const service = makeService(
      { findForActor: jest.fn().mockResolvedValue(undefined) },
      {},
      { getReportAccessFingerprint: fingerprint },
      { getFileStream },
    );

    await expect(
      service.downloadExport("4b632420-18ee-4c2a-87b4-509ad413a190", actor),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(fingerprint).not.toHaveBeenCalled();
    expect(getFileStream).not.toHaveBeenCalled();
  });

  it("blocks an export download when current report access has narrowed", async () => {
    const record = {
      id: "4b632420-18ee-4c2a-87b4-509ad413a190",
      tenantId: actor.tenantId,
      actorId: actor.userId,
      format: "xlsx",
      status: "completed",
      query: { ...query, page: 1, pageSize: 100 },
      accessFingerprint: "old-access",
      artifactKey: "reports/exports/export.xlsx",
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    };
    const getFileStream = jest.fn();
    const fingerprint = jest.fn().mockResolvedValue("narrowed-access");
    const service = makeService(
      {
        findForActor: jest.fn().mockResolvedValue(record),
        findActorIdentity: jest.fn().mockResolvedValue({
          id: actor.userId,
          email: actor.email,
          tenantId: actor.tenantId,
        }),
      },
      {},
      { getReportAccessFingerprint: fingerprint },
      { getFileStream },
    );

    await expect(service.downloadExport(record.id, actor)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(getFileStream).not.toHaveBeenCalled();
  });
});
