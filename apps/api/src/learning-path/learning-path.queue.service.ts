import { Injectable } from "@nestjs/common";

import { QUEUE_NAMES, QueueService } from "src/queue";
import { dbAls } from "src/storage/db/db-als.store";

import type { Job } from "bullmq";

@Injectable()
export class LearningPathQueueService {
  constructor(private readonly queueService: QueueService) {}

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
    const sourceTenantId = dbAls.getStore()?.tenantId;
    if (!job || !sourceTenantId || job.data.sourceTenantId !== sourceTenantId) return null;

    return {
      id: String(job.id),
      name: job.name,
      state: await job.getState(),
      attemptsMade: job.attemptsMade,
      failedReason: job.failedReason ?? null,
    };
  }
}
