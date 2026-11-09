export const OUTBOX_TABLES = ["outbox_events"] as const;

/** Whether an event's payload stays in the outbox once every handler has succeeded. */
export const OUTBOX_PAYLOAD_RETENTIONS = {
  /** Such as NativeArchiveImportFinishedEvent, declared with clearPayloadAfterDelivery. */
  CLEARED: "cleared after delivery",
  /** Such as NativeArchiveExportedEvent, kept as history. */
  KEPT: "kept as history",
} as const;

export type OutboxPayloadRetention =
  (typeof OUTBOX_PAYLOAD_RETENTIONS)[keyof typeof OUTBOX_PAYLOAD_RETENTIONS];

export const TRANSACTION_OUTCOMES = {
  COMMITTED: "committed",
  ROLLED_BACK: "rolled back",
} as const;

export type TransactionOutcome = (typeof TRANSACTION_OUTCOMES)[keyof typeof TRANSACTION_OUTCOMES];

/** Just past the 5-second delay before a failed event is claimed again. */
export const RETRY_DELAY_ELAPSED_SECONDS = 6;

/** Just past the 5 minutes after which a claimed event counts as stalled. */
export const STALLED_CLAIM_ELAPSED_SECONDS = 6 * 60;

export const PUBLICATION_CASES = [
  { transactionOutcome: TRANSACTION_OUTCOMES.COMMITTED, expectedRowCount: 1 },
  { transactionOutcome: TRANSACTION_OUTCOMES.ROLLED_BACK, expectedRowCount: 0 },
] as const;

/**
 * A concurrent claimer may come back empty while another event is still due: it re-checks the row
 * the first claimer just took and its LIMIT 1 ends there. Only "never twice" is guaranteed.
 */
export const CONCURRENT_CLAIM_CASES = [{ pendingEventCount: 1 }, { pendingEventCount: 2 }] as const;

export const PUBLISHED_PAYLOAD_CASES = [
  { payloadRetention: OUTBOX_PAYLOAD_RETENTIONS.CLEARED, keepsPayload: false },
  { payloadRetention: OUTBOX_PAYLOAD_RETENTIONS.KEPT, keepsPayload: true },
] as const;

/** Import sources outside the content marketplace are left alone by its handler. */
export const NON_MARKETPLACE_IMPORT_SOURCE = { kind: "outbox-test" } as const;

/** An outcome the event's payload schema rejects, so the dispatcher marks it dead. */
export const INVALID_IMPORT_OUTCOME = "not-an-outcome";
