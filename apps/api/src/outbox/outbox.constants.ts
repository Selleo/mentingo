export const OUTBOX_NOTIFY_CHANNEL = "outbox_events";

export const isOutboxProcessingEnabled = () =>
  !process.env.JEST_WORKER_ID && process.env.DISABLE_OUTBOX_PROCESSING !== "true";
