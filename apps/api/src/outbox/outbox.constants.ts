export const OUTBOX_NOTIFY_CHANNEL = "outbox_events";

/** An event that fails this many times is marked dead instead of being retried. */
export const OUTBOX_MAX_ATTEMPTS = 5;

/** How long a failed event waits before it may be claimed again. */
export const OUTBOX_RETRY_DELAY_SECONDS = 5;

/** How long a claim may stay in processing before it counts as abandoned. */
export const OUTBOX_STALLED_CLAIM_SECONDS = 5 * 60;

export const OUTBOX_MAX_ERROR_LENGTH = 4000;

export const OUTBOX_HANDLER_DELIVERY_OUTCOMES = {
  DELIVERED: "delivered",
  /** Another dispatcher took the event over after this one's claim went stale. */
  CLAIM_LOST: "claim-lost",
} as const;

/**
 * Events whose payload moved under one data field. API instances deployed before that change keep
 * writing flat payloads until they are replaced, so the dispatcher wraps them on claim.
 * Remove once no instance older than this change can be running.
 */
export const LEGACY_FLAT_OUTBOX_PAYLOAD_FIELDS: Readonly<Record<string, string>> = {
  NotificationEvent: "notificationData",
  AutomationEmailDeliveryRequestedEvent: "emailDeliveryRequestData",
  NativeArchiveImportFinishedEvent: "importFinishedData",
  ContentMarketplaceCourseCopiedEvent: "courseCopiedData",
  CourseDuplicatedEvent: "courseDuplicatedData",
  CourseTransferRequestedEvent: "transferRequestData",
  CourseTransferVideoMetadataRequestedEvent: "videoMetadataRequestData",
  QuizCompletedEvent: "quizCompletionData",
  UserActivityEvent: "userActivityData",
};

export const OUTBOX_EVENTS_HANDLER_METADATA = "outbox:events-handler";
export const OUTBOX_EVENT_OPTIONS_METADATA = "outbox:event-options";

export const isOutboxProcessingEnabled = () =>
  !process.env.JEST_WORKER_ID && process.env.DISABLE_OUTBOX_PROCESSING !== "true";
