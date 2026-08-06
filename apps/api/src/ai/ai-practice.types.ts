import type { SupportedLanguages } from "@repo/shared";
import type { UUIDType } from "src/common";
import type {
  aiJudgeBlockingErrors,
  aiJudgeConfigurations,
  aiJudgeCriteria,
  aiJudgeScoreGuidance,
} from "src/storage/schema";

export { AI_MENTOR_PRACTICE_STATUSES } from "@repo/shared";
export type { AiMentorPracticeStatus } from "@repo/shared";

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

export type AiPracticeJudgeConfigurationGraph = {
  configuration: Omit<
    typeof aiJudgeConfigurations.$inferInsert,
    "id" | "tenantId" | "practiceSessionId"
  > & {
    id: UUIDType;
    practiceSessionId: UUIDType;
  };
  criteria: (typeof aiJudgeCriteria.$inferInsert)[];
  scoreGuidance: (typeof aiJudgeScoreGuidance.$inferInsert)[];
  blockingErrors: (typeof aiJudgeBlockingErrors.$inferInsert)[];
};
