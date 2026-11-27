import { Injectable } from "@nestjs/common";

import { QUEUE_NAMES, QueueService } from "src/queue";

import {
  GOOGLE_CALENDAR_JOB_KINDS,
  type GoogleCalendarOutboundJobData,
  type GoogleCalendarSyncJobData,
} from "../types/google-calendar.types";

const GOOGLE_CALENDAR_JOB_OPTIONS = {
  attempts: 5,
  backoff: { type: "exponential", delay: 5_000 },
  removeOnComplete: true,
  removeOnFail: true,
};

@Injectable()
export class GoogleCalendarSyncQueueService {
  constructor(private readonly queueService: QueueService) {}

  enqueueInboundSync(data: Omit<GoogleCalendarSyncJobData, "kind">) {
    return this.queueService.enqueue(
      QUEUE_NAMES.GOOGLE_CALENDAR_SYNC,
      "synchronize-google-calendar",
      { ...data, kind: GOOGLE_CALENDAR_JOB_KINDS.INBOUND },
      { ...GOOGLE_CALENDAR_JOB_OPTIONS, jobId: `google-calendar-sync-${data.connectionId}` },
    );
  }

  enqueueOutboundSync(data: Omit<GoogleCalendarOutboundJobData, "kind">) {
    return this.queueService.enqueue(
      QUEUE_NAMES.GOOGLE_CALENDAR_SYNC,
      "synchronize-google-calendar-outbound",
      { ...data, kind: GOOGLE_CALENDAR_JOB_KINDS.OUTBOUND },
      { ...GOOGLE_CALENDAR_JOB_OPTIONS, jobId: `google-calendar-outbound-${data.connectionId}` },
    );
  }
}
