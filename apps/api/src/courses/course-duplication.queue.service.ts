import { Injectable } from "@nestjs/common";

import { QUEUE_NAMES, QueueService } from "src/queue";

import type { Job } from "bullmq";
import type { CourseDuplicationJobData } from "src/queue";

export const COURSE_DUPLICATION_JOB_NAME = "course-duplication";

@Injectable()
export class CourseDuplicationQueueService {
  constructor(private readonly queueService: QueueService) {}

  enqueueDuplication(data: CourseDuplicationJobData): Promise<Job<CourseDuplicationJobData>> {
    return this.queueService.enqueue(
      QUEUE_NAMES.COURSE_DUPLICATION,
      COURSE_DUPLICATION_JOB_NAME,
      data,
      {
        attempts: 1,
        removeOnComplete: false,
        removeOnFail: false,
      },
    );
  }

  async getJobStatus(jobId: string): Promise<{
    id: string;
    name: string;
    state: string;
    attemptsMade: number;
    failedReason: string | null;
  } | null> {
    const job = await this.queueService.getQueue(QUEUE_NAMES.COURSE_DUPLICATION).getJob(jobId);
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
