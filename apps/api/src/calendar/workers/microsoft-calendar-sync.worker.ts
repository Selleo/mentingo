import { Injectable, type OnModuleDestroy } from "@nestjs/common";
import { Worker } from "bullmq";

import { QUEUE_NAMES, QueueService } from "src/queue";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import { MicrosoftCalendarService } from "../services/microsoft-calendar.service";

import type { MicrosoftCalendarSyncJobData } from "../types/microsoft-calendar.types";

@Injectable()
export class MicrosoftCalendarSyncWorker implements OnModuleDestroy {
  private readonly worker: Worker<MicrosoftCalendarSyncJobData>;

  constructor(
    queueService: QueueService,
    private readonly tenantRunner: TenantDbRunnerService,
    private readonly microsoftCalendarService: MicrosoftCalendarService,
  ) {
    this.worker = new Worker<MicrosoftCalendarSyncJobData>(
      QUEUE_NAMES.MICROSOFT_CALENDAR_SYNC,
      (job) => this.processJob(job),
      {
        connection: queueService.getConnection(),
        concurrency: process.env.NODE_ENV === "test" ? 1 : 5,
      },
    );
  }

  private async processJob(job: { id?: string; data: MicrosoftCalendarSyncJobData }) {
    return this.tenantRunner.runWithTenant(job.data.tenantId, () =>
      this.microsoftCalendarService.synchronizeConnection(job.data.connectionId, job.data.fullSync),
    );
  }

  async onModuleDestroy() {
    await this.worker.close();
  }
}
