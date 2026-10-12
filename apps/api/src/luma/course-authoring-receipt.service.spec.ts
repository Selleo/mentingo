import { CourseAuthoringReceiptService } from "./course-authoring-receipt.service";

import type { CourseAuthoringApplicationRepository } from "./course-authoring-application.repository";
import type { CourseAuthoringApplicationService } from "./course-authoring-application.service";
import type { LumaService } from "./luma.service";
import type { QueueService } from "src/queue";
import type { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

const data = {
  tenantId: "tenant",
  courseId: "course",
  sessionId: "session",
  exportId: "export",
  exportHash: "hash",
};
function setup() {
  const recordReceipt = jest.fn().mockResolvedValue(undefined);
  const markDelivered = jest.fn().mockResolvedValue(undefined);
  const findReceipt = jest.fn().mockResolvedValue({
    ...data,
    applicationId: "application",
    entityMappings: {},
    status: "applied",
  });
  const enqueue = jest.fn().mockResolvedValue(undefined);
  const service = new CourseAuthoringReceiptService(
    {
      findReceipt,
      markDelivered,
      pendingReceipts: jest.fn().mockResolvedValue([data]),
    } as unknown as CourseAuthoringApplicationRepository,
    {
      getLumaClient: jest.fn().mockResolvedValue({ authoring: { recordReceipt } }),
    } as unknown as LumaService,
    { enqueue } as unknown as QueueService,
    {
      runForEachTenant: (fn: (id: string) => Promise<void>) => fn(data.tenantId),
    } as unknown as TenantDbRunnerService,
    {
      reconcileFailedApplications: jest.fn().mockResolvedValue(0),
    } as unknown as CourseAuthoringApplicationService,
  );
  return { service, recordReceipt, markDelivered, findReceipt, enqueue };
}

describe("CourseAuthoringReceiptService recovery", () => {
  it("leaves an undelivered receipt pending when remote delivery fails", async () => {
    const test = setup();
    test.recordReceipt.mockRejectedValue(new Error("unavailable"));
    await expect(test.service.deliver(data)).rejects.toThrow("unavailable");
    expect(test.markDelivered).not.toHaveBeenCalled();
  });
  it("marks only the matching tenant/export/hash after successful delivery", async () => {
    const test = setup();
    await test.service.deliver(data);
    expect(test.markDelivered).toHaveBeenCalledWith(data.tenantId, data.exportId, data.exportHash);
    test.findReceipt.mockResolvedValue({ ...data, exportHash: "changed" });
    await expect(test.service.deliver(data)).rejects.toThrow(
      "courseAuthoring.errors.exportIdentityConflict",
    );
    expect(test.recordReceipt).toHaveBeenCalledTimes(1);
  });
  it.each(["failed", "conflict"])(
    "delivers a durable %s outcome without applied mappings",
    async (status) => {
      const test = setup();
      test.findReceipt.mockResolvedValue({
        ...data,
        applicationId: "failure",
        entityMappings: {},
        status,
        reason: "courseAuthoring.errors.applicationFailed",
      });
      await test.service.deliver(data);
      expect(test.recordReceipt).toHaveBeenCalledWith({
        sessionId: data.sessionId,
        receipt: expect.objectContaining({
          status,
          idMappings: {},
          reason: "courseAuthoring.errors.applicationFailed",
        }),
      });
      expect(test.markDelivered).toHaveBeenCalled();
    },
  );
  it("re-enqueues still-pending receipts on later scans with stable receipt-only job identity", async () => {
    const test = setup();
    await test.service.enqueuePendingReceipts();
    await test.service.enqueuePendingReceipts();
    expect(test.enqueue).toHaveBeenCalledTimes(2);
    expect(test.enqueue).toHaveBeenLastCalledWith(
      "course-authoring-apply",
      "receipt",
      data,
      expect.objectContaining({ jobId: "receipt-tenant-export", removeOnFail: true, attempts: 5 }),
    );
  });
});
