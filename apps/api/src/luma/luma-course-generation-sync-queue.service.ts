import { Injectable } from "@nestjs/common";

import { QUEUE_NAMES, QueueService } from "src/queue";

import type { LumaCourseGenerationSyncJobData } from "src/queue";

export const LUMA_COURSE_GENERATION_SYNC_JOB_NAME = "luma-course-generation-sync";

@Injectable()
export class LumaCourseGenerationSyncQueueService {
  constructor(private readonly queueService: QueueService) {}

  async enqueueSyncJob(data: LumaCourseGenerationSyncJobData): Promise<void> {
    await this.queueService.enqueue<LumaCourseGenerationSyncJobData>(
      QUEUE_NAMES.LUMA_COURSE_GENERATION_SYNC,
      LUMA_COURSE_GENERATION_SYNC_JOB_NAME,
      data,
      {
        attempts: 1,
        jobId: data.courseId,
        removeOnComplete: true,
        removeOnFail: true,
      },
    );
  }
}
