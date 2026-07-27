import { Injectable, type OnModuleDestroy } from "@nestjs/common";
import { Worker } from "bullmq";

import { QUEUE_NAMES, QueueService } from "src/queue";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import { MicrosoftCalendarOutboundService } from "../services/microsoft-calendar-outbound.service";
import { MicrosoftCalendarService } from "../services/microsoft-calendar.service";

import type {
  MicrosoftCalendarOutboundJobData,
  MicrosoftCalendarSyncJobData,
} from "../types/microsoft-calendar.types";

@Injectable()
export class MicrosoftCalendarSyncWorker implements OnModuleDestroy {
  private readonly worker: Worker<MicrosoftCalendarSyncJobData | MicrosoftCalendarOutboundJobData>;

  constructor(
    queueService: QueueService,
    private readonly tenantDbRunnerService: TenantDbRunnerService,
    private readonly microsoftCalendarService: MicrosoftCalendarService,
    private readonly outboundService: MicrosoftCalendarOutboundService,
  ) {
    this.worker = new Worker<MicrosoftCalendarSyncJobData | MicrosoftCalendarOutboundJobData>(
      QUEUE_NAMES.MICROSOFT_CALENDAR_SYNC,
      (job) => this.processJob(job),
      {
        connection: queueService.getConnection(),
        concurrency: process.env.NODE_ENV === "test" ? 1 : 5,
      },
    );
  }

  private async processJob(job: {
    id?: string;
    data: MicrosoftCalendarSyncJobData | MicrosoftCalendarOutboundJobData;
  }) {
    return this.tenantDbRunnerService.runWithTenant(job.data.tenantId, () =>
      "fullSync" in job.data
        ? this.microsoftCalendarService.synchronizeConnection(
            job.data.connectionId,
            job.data.fullSync,
            job.data.reason,
          )
        : this.outboundService.reconcileConnection(job.data.connectionId),
    );
  }

  async onModuleDestroy() {
    await this.worker.close();
  }
}
