import type { AssistantRunActivity, AssistantSourceType } from "@repo/shared";

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
  role: "user" | "assistant";
  clientMessageId?: string | null;
  text: string;
  status: "complete" | "pending" | "running" | "failed" | "cancelled";
  sources: AssistantSource[];
  createdAt: string;
};

export type AssistantRun = {
  id: string;
  threadId: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  errorCode: string | null;
  activity?: AssistantRunActivity | null;
};

export const isAssistantRunActive = (run: AssistantRun | null | undefined) =>
  run?.status === "pending" || run?.status === "running";
