import { Injectable } from "@nestjs/common";

import { QUEUE_NAMES, QueueService } from "src/queue";

import type { Job } from "bullmq";
import type { MasterCourseExportJobData, MasterCourseSyncJobData } from "src/queue";

@Injectable()
export class MasterCourseQueueService {
  constructor(private readonly queueService: QueueService) {}

  enqueueExport(data: MasterCourseExportJobData) {
    return this.queueService.enqueue(
      QUEUE_NAMES.MASTER_COURSE_EXPORT,
      "master-course-export",
      data,
      {
        attempts: 3,
        backoff: { type: "exponential", delay: 1000 },
      },
    );
  }

  enqueueSync(data: MasterCourseSyncJobData, jobId?: string) {
    return this.queueService.enqueue(QUEUE_NAMES.MASTER_COURSE_SYNC, "master-course-sync", data, {
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
      this.queueService.getQueue(QUEUE_NAMES.MASTER_COURSE_EXPORT).getJob(jobId),
      this.queueService.getQueue(QUEUE_NAMES.MASTER_COURSE_SYNC).getJob(jobId),
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
