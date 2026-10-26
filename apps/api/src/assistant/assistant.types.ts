import type {
  SupportedLanguages,
  AssistantRunActivity,
  AssistantRunStatus,
  ASSISTANT_RUN_STATUSES,
} from "@repo/shared";
import type {
  assistantMessages,
  assistantRuns,
  assistantThreads,
  tenants,
  AssistantSource,
} from "src/storage/schema";

export type AssistantThread = typeof assistantThreads.$inferSelect;
export type AssistantMessage = typeof assistantMessages.$inferSelect;
export type AssistantRun = typeof assistantRuns.$inferSelect;
export type AssistantRunCursor = Pick<AssistantRun, "createdAt" | "id">;
export type AssistantRunIdentity = { runId: string; tenantId: string };
export type AssistantActorIdentity = { tenantId: string; userId: string };
export type AssistantTenantState = Pick<typeof tenants.$inferSelect, "host" | "status">;
export type AssistantStartInput = AssistantRunIdentity & {
  threadId: string;
  userId: string;
  language: SupportedLanguages;
  origin: string;
};
export type AssistantSendResult = {
  userMessage: AssistantMessage;
  assistantMessage: AssistantMessage;
  run: AssistantRun;
};
export type AssistantPageInput = { page?: number; perPage?: number };
export type AssistantPage<T> = { items: T[]; page: number; perPage: number; totalItems: number };
export type { AssistantSource };

export type AssistantRunUpdate = {
  status?: Exclude<AssistantRunStatus, typeof ASSISTANT_RUN_STATUSES.PENDING>;
  activity?: AssistantRunActivity | null;
  text?: string;
  sources?: AssistantSource[];
  messageSources?: AssistantSource[];
  errorCode?: string;
  recordTool?: { readable: boolean };
};
