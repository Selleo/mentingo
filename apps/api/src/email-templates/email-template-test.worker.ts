import { Injectable, Logger, type OnModuleDestroy } from "@nestjs/common";
import { Worker } from "bullmq";

import { QUEUE_NAMES, QueueService } from "src/queue";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import { EmailTemplateTestService } from "./services/email-template-test.service";

import type { EmailTemplateTestJobData } from "./email-template.types";

@Injectable()
export class EmailTemplateTestWorker implements OnModuleDestroy {
  private readonly logger = new Logger(EmailTemplateTestWorker.name);
  private readonly worker: Worker<EmailTemplateTestJobData>;

  constructor(
    queueService: QueueService,
    tenantRunner: TenantDbRunnerService,
    testService: EmailTemplateTestService,
  ) {
    this.worker = new Worker<EmailTemplateTestJobData>(
      QUEUE_NAMES.EMAIL_TEMPLATE_TEST,
      (job) =>
        tenantRunner.runWithTenant(job.data.tenantId, () =>
          testService.sendTestEmailTemplate(job.data),
        ),
      { connection: queueService.getConnection(), concurrency: 2 },
    );
    this.worker.on("failed", (job) =>
      this.logger.error(`Email template test job failed: ${job?.id}`),
    );
  }

  async onModuleDestroy() {
    await this.worker.close();
  }
}
