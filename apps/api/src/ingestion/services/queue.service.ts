import { Injectable } from "@nestjs/common";

import {
  type DocumentIngestionJobData,
  QUEUE_NAMES,
  QueueService as GlobalQueueService,
} from "src/queue";

import type { Job } from "bullmq";
import type { UUIDType } from "src/common";

@Injectable()
export class IngestionQueueService {
  constructor(private readonly queueService: GlobalQueueService) {}

  async enqueueDocumentIngestion(
    tenantId: UUIDType,
    lessonId: UUIDType,
    file: Express.Multer.File,
  ) {
    return this.queueService.enqueue<DocumentIngestionJobData>(
      QUEUE_NAMES.DOCUMENT_INGESTION,
      "document-ingestion",
      { tenantId, lessonId, file },
      { attempts: 3, backoff: { type: "exponential", delay: 1000 }, removeOnComplete: true },
    );
  }

  async waitForJobsCompletion(jobs: Job[]) {
    return this.queueService.waitForJobsCompletion(QUEUE_NAMES.DOCUMENT_INGESTION, jobs);
  }
}
