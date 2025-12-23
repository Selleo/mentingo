import { Injectable } from "@nestjs/common";

import {
  type DocumentIngestionJobData,
  QUEUE_NAMES,
  QueueService as GlobalQueueService,
} from "src/queue";

import type { Job } from "bullmq";

@Injectable()
export class IngestionQueueService {
  constructor(private readonly queueService: GlobalQueueService) {}

  async enqueueDocumentIngestion(file: Express.Multer.File, documentId: string, sha256: string) {
    return this.queueService.enqueue<DocumentIngestionJobData>(
      QUEUE_NAMES.DOCUMENT_INGESTION,
      "document-ingestion",
      { file, documentId, sha256 },
      { attempts: 3, backoff: { type: "exponential", delay: 1000 }, removeOnComplete: true },
    );
  }

  async waitForJobsCompletion(jobs: Job[]) {
    return this.queueService.waitForJobsCompletion(QUEUE_NAMES.DOCUMENT_INGESTION, jobs);
  }
}
