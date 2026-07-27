import { Injectable } from "@nestjs/common";

import { QUEUE_NAMES, QueueService } from "src/queue";

import type {
  MicrosoftCalendarOutboundJobData,
  MicrosoftCalendarSyncJobData,
} from "../types/microsoft-calendar.types";

@Injectable()
export class MicrosoftCalendarSyncQueueService {
  constructor(private readonly queueService: QueueService) {}

  enqueue(data: MicrosoftCalendarSyncJobData) {
    return this.queueService.enqueue(
      QUEUE_NAMES.MICROSOFT_CALENDAR_SYNC,
      "synchronize-microsoft-calendar",
      data,
      {
        jobId: `microsoft-calendar-sync-${data.connectionId}`,
        attempts: 5,
        backoff: { type: "exponential", delay: 5_000 },
        removeOnComplete: true,
        removeOnFail: true,
      },
    );
  }

  enqueueOutbound(data: MicrosoftCalendarOutboundJobData) {
    return this.queueService.enqueue(
      QUEUE_NAMES.MICROSOFT_CALENDAR_SYNC,
      "synchronize-microsoft-calendar-outbound",
      data,
      {
        jobId: `microsoft-calendar-outbound-${data.connectionId}`,
        attempts: 5,
        backoff: { type: "exponential", delay: 5_000 },
        removeOnComplete: true,
        removeOnFail: true,
      },
    );
  }
}
