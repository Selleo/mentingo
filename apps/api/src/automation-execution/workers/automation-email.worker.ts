import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from "@nestjs/common";
import { Worker } from "bullmq";

import { QueueService, QUEUE_NAMES } from "src/queue";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import { AutomationEmailDeliveryService } from "../services/automation-email-delivery.service";

import type { AutomationEmailDeliveryJob } from "../automation-execution.types";

@Injectable()
export class AutomationEmailWorker implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(AutomationEmailWorker.name);

  private worker?: Worker<AutomationEmailDeliveryJob>;

  constructor(
    private readonly queueService: QueueService,
    private readonly tenantDbRunnerService: TenantDbRunnerService,
    private readonly automationEmailDeliveryService: AutomationEmailDeliveryService,
  ) {}

  onApplicationBootstrap(): void {
    this.worker = new Worker<AutomationEmailDeliveryJob>(
      QUEUE_NAMES.AUTOMATION_EMAIL,
      (job) =>
        this.tenantDbRunnerService.runWithTenant(job.data.tenantId, () =>
          this.automationEmailDeliveryService.sendAutomationEmail(
            job.data.emailDeliveryId,
            job.data.tenantId,
          ),
        ),
      { connection: this.queueService.getConnection(), concurrency: 5 },
    );

    this.worker.on("error", () => this.logger.error("Automation email worker error"));
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }
}
