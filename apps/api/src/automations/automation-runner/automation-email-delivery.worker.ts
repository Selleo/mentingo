import { Injectable, InternalServerErrorException, Logger, type OnModuleDestroy } from "@nestjs/common";
import { Worker } from "bullmq";

import { EmailService } from "src/common/emails/emails.service";
import { QUEUE_NAMES, QueueService } from "src/queue";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import { AutomationLogsRepository } from "../repositories/automation-logs/automation-logs";

import type { Job } from "bullmq";
import type { AutomationEmailDeliveryJobData } from "src/queue";

export const AUTOMATION_EMAIL_DELIVERY_JOB_NAME = "send-automation-email";

@Injectable()
export class AutomationEmailDeliveryWorker implements OnModuleDestroy {
  private readonly logger = new Logger(AutomationEmailDeliveryWorker.name);
  private readonly worker: Worker<AutomationEmailDeliveryJobData>;

  constructor(
    private readonly queueService: QueueService,
    private readonly emailService: EmailService,
    private readonly automationLogsRepository: AutomationLogsRepository,
    private readonly tenantRunner: TenantDbRunnerService,
  ) {
    this.worker = new Worker<AutomationEmailDeliveryJobData>(
      QUEUE_NAMES.AUTOMATION_EMAIL_DELIVERY,
      (job) => this.process(job),
      {
        connection: this.queueService.getConnection(),
        concurrency: Number(process.env.AUTOMATION_EMAIL_WORKER_CONCURRENCY || 5),
      },
    );

    this.worker.on("failed", (job, error) => {
      if (!job || job.attemptsMade < (job.opts.attempts ?? 1)) return;

      this.logger.error(`Automation email job ${job.id} failed after retries: ${error.message}`);
      void this.tenantRunner.runWithTenant(job.data.tenantId, () =>
        this.automationLogsRepository.create({
          automationId: job.data.automationId,
          automationName: job.data.automationName,
          eventName: job.data.eventName,
          status: "failed",
          emailAddresses: [job.data.recipientEmail],
          errorName: error.name,
        }),
      );
    });
  }

  private async process(job: Job<AutomationEmailDeliveryJobData>) {
    if (job.name !== AUTOMATION_EMAIL_DELIVERY_JOB_NAME) {
      throw new InternalServerErrorException(`Unexpected automation email job: ${job.name}`);
    }

    await this.emailService.sendEmailWithLogo(
      {
        to: job.data.recipientEmail,
        subject: job.data.subject,
        text: job.data.text,
        html: job.data.html,
      },
      { tenantId: job.data.tenantId },
    );
  }

  async onModuleDestroy() {
    await this.worker.close();
  }
}
