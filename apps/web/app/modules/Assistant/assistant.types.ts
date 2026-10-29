import { ASSISTANT_RUN_STATUSES } from "@repo/shared";

import type {
  AssistantRunActivity,
  AssistantSourceType,
  AssistantMessageRole,
  AssistantMessageStatus,
  AssistantRunStatus,
} from "@repo/shared";

export type AssistantSource = {
  title: string;
  url: string;
  entityType?: AssistantSourceType;
  description?: string;
};

export type AssistantThread = {
  id: string;
  title: string;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AssistantMessage = {
  id: string;
  threadId: string;
  role: AssistantMessageRole;
  clientMessageId?: string | null;
  text: string;
  status: AssistantMessageStatus;
  sources: AssistantSource[];
  createdAt: string;
};

export type AssistantRun = {
  id: string;
  threadId: string;
  status: AssistantRunStatus;
  errorCode: string | null;
  activity?: AssistantRunActivity | null;
};

export const isAssistantRunActive = (run: AssistantRun | null | undefined) =>
  run?.status === ASSISTANT_RUN_STATUSES.PENDING || run?.status === ASSISTANT_RUN_STATUSES.RUNNING;
