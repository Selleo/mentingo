import { Worker } from "bullmq";

import { ReportsExportWorker } from "./reports-export.worker";

import type { ReportsExportsService } from "./reports-exports.service";
import type { Job } from "bullmq";
import type { QueueService } from "src/queue";
import type { ReportExportJobData } from "src/queue/queue.types";

jest.mock("bullmq", () => ({
  Worker: jest.fn().mockImplementation(() => ({ on: jest.fn(), close: jest.fn() })),
}));

describe("ReportsExportWorker retry handling", () => {
  beforeEach(() => jest.clearAllMocks());

  it.each([
    [0, 3, false],
    [1, 3, false],
    [2, 3, true],
    [0, undefined, true],
  ])(
    "passes the final-attempt state for attempt %s of %s",
    async (attemptsMade, attempts, final) => {
      const processExportGenerationJob = jest.fn();
      const worker = new ReportsExportWorker(
        { getConnection: () => ({}) } as QueueService,
        { processExportGenerationJob } as unknown as ReportsExportsService,
      );
      const processor = jest.mocked(Worker).mock.calls[0][1];
      if (typeof processor !== "function") throw new Error("Missing export processor");
      const data: ReportExportJobData = {
        tenantId: "tenant",
        actorId: "actor",
        exportId: "export",
        action: "generate",
      };
      await processor({ data, attemptsMade, opts: { attempts } } as Job<ReportExportJobData>);
      expect(processExportGenerationJob).toHaveBeenCalledWith(data, final);
      await worker.onModuleDestroy();
    },
  );
});
