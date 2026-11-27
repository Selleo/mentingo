import { Injectable } from "@nestjs/common";

import { QUEUE_NAMES, QueueService } from "src/queue";

import { DIRECTORY_SYNC_JOB_NAME } from "../directory-sync.constants";

import type { DirectorySyncJobData } from "../schemas/directory-sync-job.schema";

@Injectable()
export class DirectorySyncQueueService {
  constructor(private readonly queueService: QueueService) {}

  enqueueDirectorySyncJob(jobData: DirectorySyncJobData) {
    return this.queueService.enqueue(QUEUE_NAMES.DIRECTORY_SYNC, DIRECTORY_SYNC_JOB_NAME, jobData, {
      jobId: `directory-sync-run-${jobData.runId}`,
      attempts: 1,
      removeOnComplete: true,
      removeOnFail: true,
    });
  }
}
