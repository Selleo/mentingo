import { Injectable } from "@nestjs/common";

import { QUEUE_NAMES, QueueService } from "src/queue";

import type { Job } from "bullmq";
import type { LearningPathExportJobData, LearningPathSyncJobData } from "src/queue/queue.types";

@Injectable()
export class LearningPathQueueService {
  constructor(private readonly queueService: QueueService) {}

  enqueueExport(data: LearningPathExportJobData) {
    return this.queueService.enqueue(
      QUEUE_NAMES.LEARNING_PATH_EXPORT,
      "learning-path-export",
      data,
      {
        attempts: 3,
        backoff: { type: "exponential", delay: 1000 },
      },
    );
  }

  enqueueSync(data: LearningPathSyncJobData, jobId?: string) {
    return this.queueService.enqueue(QUEUE_NAMES.LEARNING_PATH_SYNC, "learning-path-sync", data, {
      attempts: 3,
      backoff: { type: "exponential", delay: 1000 },
      ...(jobId ? { jobId } : {}),
    });
  }

  async getJobStatus(jobId: string): Promise<{
    id: string;
    name: string;
    state: string;
    attemptsMade: number;
    failedReason: string | null;
  } | null> {
    const [exportJob, syncJob] = await Promise.all([
      this.queueService.getQueue(QUEUE_NAMES.LEARNING_PATH_EXPORT).getJob(jobId),
      this.queueService.getQueue(QUEUE_NAMES.LEARNING_PATH_SYNC).getJob(jobId),
    ]);

    const job: Job | undefined = exportJob ?? syncJob ?? undefined;
    if (!job) return null;

    return {
      id: String(job.id),
      name: job.name,
      state: await job.getState(),
      attemptsMade: job.attemptsMade,
      failedReason: job.failedReason ?? null,
    };
  }
}
