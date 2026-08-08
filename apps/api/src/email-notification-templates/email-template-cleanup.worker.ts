import {
  Injectable,
  InternalServerErrorException,
  Logger,
  type OnModuleDestroy,
} from "@nestjs/common";
import { Worker } from "bullmq";

import { EMAIL_TEMPLATE_IMAGE_CLEANUP_JOB_NAME } from "src/email-notification-templates/email-template-cleanup.queue.service";
import { EmailNotificationTemplatesService } from "src/email-notification-templates/email-templates.service";
import { QUEUE_NAMES, QueueService } from "src/queue";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import type { Job } from "bullmq";
import type { EmailTemplateImageCleanupJobData } from "src/queue";

@Injectable()
export class EmailTemplateCleanupWorker implements OnModuleDestroy {
  private readonly logger = new Logger(EmailTemplateCleanupWorker.name);
  private readonly worker: Worker<EmailTemplateImageCleanupJobData>;

  constructor(
    private readonly queueService: QueueService,
    private readonly emailTemplatesService: EmailNotificationTemplatesService,
    private readonly tenantRunner: TenantDbRunnerService,
  ) {
    this.worker = new Worker<EmailTemplateImageCleanupJobData>(
      QUEUE_NAMES.EMAIL_TEMPLATE_IMAGE_CLEANUP,
      (job) => this.handleImageCleanup(job),
      {
        connection: this.queueService.getConnection(),
        concurrency: Number(process.env.EMAIL_TEMPLATE_CLEANUP_WORKER_CONCURRENCY || 1),
      },
    );

    this.worker.on("failed", (job, err) => {
      this.logger.error(`Email template image cleanup job ${job?.id} failed: ${err.message}`);
    });
  }

  private async handleImageCleanup(job: Job<EmailTemplateImageCleanupJobData>): Promise<void> {
    if (job.name !== EMAIL_TEMPLATE_IMAGE_CLEANUP_JOB_NAME) {
      throw new InternalServerErrorException(
        `Unexpected email template image cleanup job name: ${job.name}`,
      );
    }

    await this.tenantRunner.runWithTenant(job.data.tenantId, () =>
      this.emailTemplatesService.purgeOrphanedImages(job.data),
    );
  }

  async onModuleDestroy() {
    await this.worker.close();
  }
}
