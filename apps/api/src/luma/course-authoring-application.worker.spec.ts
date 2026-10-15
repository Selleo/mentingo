import { ConflictException } from "@nestjs/common";
import { UnrecoverableError, type Job } from "bullmq";

import { CourseAuthoringApplicationWorker } from "./course-authoring-application.worker";

import type { CourseAuthoringApplicationService } from "./course-authoring-application.service";
import type { CourseAuthoringReceiptService } from "./course-authoring-receipt.service";
import type { CourseAuthoringApplyJob, CourseAuthoringReceiptJob } from "./course-authoring.types";
import type { QueueService } from "src/queue";
import type { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

let mockProcessor: (
  job: Job<CourseAuthoringApplyJob | CourseAuthoringReceiptJob>,
) => Promise<unknown>;
jest.mock("bullmq", () => ({
  ...jest.requireActual("bullmq"),
  Worker: jest.fn().mockImplementation((_queue, processor) => {
    mockProcessor = processor;
    return { on: jest.fn(), close: jest.fn() };
  }),
}));

describe("Authoring terminal failure boundaries", () => {
  it.each([
    { attemptsMade: 0, permanent: false, terminal: false },
    { attemptsMade: 2, permanent: false, terminal: true },
    { attemptsMade: 0, permanent: true, terminal: true },
  ])(
    "publishes failure only at an authoritative terminal boundary %j",
    async ({ attemptsMade, permanent, terminal }) => {
      const error = permanent
        ? new ConflictException("courseAuthoring.errors.baselineChanged")
        : new Error("storage unavailable");
      const process = jest.fn().mockRejectedValue(error);
      const recordTerminalFailure = jest.fn().mockResolvedValue(undefined);
      new CourseAuthoringApplicationWorker(
        { getConnection: jest.fn() } as unknown as QueueService,
        {
          runWithTenant: (_tenant: string, action: () => Promise<unknown>) => action(),
        } as unknown as TenantDbRunnerService,
        { process, recordTerminalFailure } as unknown as CourseAuthoringApplicationService,
        {} as CourseAuthoringReceiptService,
      );
      const data = {
        courseId: "course",
        sessionId: "session",
        exportId: "export",
        actor: { tenantId: "tenant" },
      };
      const job = {
        data,
        attemptsMade,
        opts: { attempts: 3 },
      } as unknown as Job<CourseAuthoringApplyJob>;
      await expect(mockProcessor(job)).rejects.toBeInstanceOf(
        permanent ? UnrecoverableError : Error,
      );
      expect(recordTerminalFailure).toHaveBeenCalledTimes(terminal ? 1 : 0);
      if (terminal) expect(recordTerminalFailure).toHaveBeenCalledWith(data, error.message);
    },
  );
});
