export const OUTBOX_STATUSES = {
  PENDING: "pending",
  PROCESSING: "processing",
  PUBLISHED: "published",
  FAILED: "failed",
} as const;

export type OutboxStatus = (typeof OUTBOX_STATUSES)[keyof typeof OUTBOX_STATUSES];

export interface OutboxEnvelope<TPayload = Record<string, unknown>> {
  id: string;
  eventType: string;
  payload: TPayload;
  status: OutboxStatus;
  attemptCount: number;
  publishedAt: string | null;
  lastError: string | null;
  createdAt: string;
  tenantId: string;
}
