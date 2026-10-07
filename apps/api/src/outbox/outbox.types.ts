import type { DatabasePg } from "src/common";

export type OutboxCommandHandler = (
  payload: Record<string, unknown>,
  id: string,
  transaction?: DatabasePg,
) => Promise<void>;

export type OutboxNotificationPreparer = (event: object) => Promise<object[]>;

export type OutboxPublication = {
  eventType: string;
  payload: Record<string, unknown>;
};

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
