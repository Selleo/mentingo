import { Injectable, type OnModuleDestroy } from "@nestjs/common";
import { Worker } from "bullmq";
import { match } from "ts-pattern";

import { QUEUE_NAMES, QueueService } from "src/queue";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import { GoogleCalendarOutboundService } from "../services/google-calendar-outbound.service";
import { GoogleCalendarService } from "../services/google-calendar.service";
import {
  GOOGLE_CALENDAR_JOB_KINDS,
  type GoogleCalendarJobData,
} from "../types/google-calendar.types";

@Injectable()
export class GoogleCalendarSyncWorker implements OnModuleDestroy {
  private readonly worker: Worker<GoogleCalendarJobData>;

  constructor(
    queueService: QueueService,
    private readonly tenantDbRunnerService: TenantDbRunnerService,
    private readonly googleCalendarService: GoogleCalendarService,
    private readonly googleCalendarOutboundService: GoogleCalendarOutboundService,
  ) {
    this.worker = new Worker<GoogleCalendarJobData>(
      QUEUE_NAMES.GOOGLE_CALENDAR_SYNC,
      (job) => this.synchronizeGoogleCalendar(job.data),
      {
        connection: queueService.getConnection(),
        concurrency: process.env.NODE_ENV === "test" ? 1 : 5,
      },
    );
  }

  private async synchronizeGoogleCalendar(jobData: GoogleCalendarJobData) {
    return this.tenantDbRunnerService.runWithTenant(jobData.tenantId, () =>
      match(jobData)
        .with({ kind: GOOGLE_CALENDAR_JOB_KINDS.INBOUND }, (inboundJob) =>
          this.googleCalendarService.synchronizeConnection(
            inboundJob.connectionId,
            inboundJob.fullSync,
            inboundJob.reason,
          ),
        )
        .with({ kind: GOOGLE_CALENDAR_JOB_KINDS.OUTBOUND }, (outboundJob) =>
          this.googleCalendarOutboundService.exportMentingoEventsToGoogleCalendar(
            outboundJob.connectionId,
          ),
        )
        .exhaustive(),
    );
  }

  async onModuleDestroy() {
    await this.worker.close();
  }
}
