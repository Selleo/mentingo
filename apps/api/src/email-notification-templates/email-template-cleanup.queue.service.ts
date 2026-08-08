import { Injectable } from "@nestjs/common";

import { QUEUE_NAMES, QueueService } from "src/queue";

import type { EmailTemplateImageCleanupJobData } from "src/queue";

export const EMAIL_TEMPLATE_IMAGE_CLEANUP_JOB_NAME = "email-template-image-cleanup";

@Injectable()
export class EmailTemplateCleanupQueueService {
  constructor(private readonly queueService: QueueService) {}

  async enqueueImageCleanup(data: EmailTemplateImageCleanupJobData): Promise<void> {
    await this.queueService.enqueue(
      QUEUE_NAMES.EMAIL_TEMPLATE_IMAGE_CLEANUP,
      EMAIL_TEMPLATE_IMAGE_CLEANUP_JOB_NAME,
      data,
      {
        attempts: 3,
        backoff: { type: "exponential", delay: 1000 },
        removeOnComplete: true,
        removeOnFail: false,
      },
    );
  }
}
