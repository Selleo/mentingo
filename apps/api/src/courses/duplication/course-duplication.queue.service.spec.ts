import { CourseDuplicationQueueService } from "./course-duplication.queue.service";

import type { QueueService } from "src/queue";

describe("CourseDuplicationQueueService", () => {
  it("reads failure details after the job reaches its failed state", async () => {
    const persistedJob = {
      id: "job-id",
      name: "course-duplication",
      attemptsMade: 0,
      failedReason: null as string | null,
    };
    const failedReason = "courseDuplication.error.foreignSourceAsset";
    const getJobState = jest.fn().mockImplementation(async () => {
      persistedJob.attemptsMade = 1;
      persistedJob.failedReason = failedReason;
      return "failed";
    });
    const queue = {
      getJob: jest.fn().mockImplementation(async () => ({
        ...persistedJob,
        getState: getJobState,
      })),
      getJobState,
    };
    const service = new CourseDuplicationQueueService({
      getQueue: () => queue,
    } as unknown as QueueService);

    await expect(service.getJobStatus(persistedJob.id)).resolves.toMatchObject({
      state: "failed",
      attemptsMade: 1,
      failedReason,
    });
  });
});
