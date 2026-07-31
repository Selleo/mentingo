import type { SupportedLanguages } from "@repo/shared";
import type { UUIDType } from "src/common";

export const AI_MENTOR_PRACTICE_STATUSES = {
  QUEUED: "queued",
  PROCESSING: "processing",
  READY: "ready",
  FAILED: "failed",
} as const;

export type AiMentorPracticeStatus =
  (typeof AI_MENTOR_PRACTICE_STATUSES)[keyof typeof AI_MENTOR_PRACTICE_STATUSES];

export type AiMentorPracticeJobData = {
  tenantId: UUIDType;
  sessionId: UUIDType;
};

export type AiMentorPracticeGenerationInput = {
  challenge: string;
  counterpart: string;
  desiredOutcome: string;
  language: SupportedLanguages;
};
