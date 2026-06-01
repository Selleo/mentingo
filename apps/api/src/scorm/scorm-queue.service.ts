import { Injectable } from "@nestjs/common";

import { QUEUE_NAMES, QueueService } from "src/queue";

import type { AnyScormImportJobData } from "./scorm.types";

export const SCORM_IMPORT_JOB_NAME = "scorm-import";

@Injectable()
export class ScormQueueService {
  constructor(private readonly queueService: QueueService) {}

  async enqueueImportJob(data: AnyScormImportJobData): Promise<void> {
    await this.queueService.enqueue<AnyScormImportJobData>(
      QUEUE_NAMES.SCORM_IMPORT,
      SCORM_IMPORT_JOB_NAME,
      data,
      {
        attempts: 1,
        removeOnComplete: true,
      },
    );
  }
}
