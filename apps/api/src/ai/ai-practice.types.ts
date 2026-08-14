import type { LocalizedText, SupportedLanguages } from "@repo/shared";
import type { SQL } from "drizzle-orm";
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
  scenario: string;
  language: SupportedLanguages;
};

export type AiPracticeJudgeConfigurationGraph = {
  configuration: Omit<
    typeof aiJudgeConfigurations.$inferInsert,
    "id" | "tenantId" | "practiceSessionId" | "taskGoal"
  > & {
    id: UUIDType;
    practiceSessionId: UUIDType;
    taskGoal: LocalizedText | SQL<unknown>;
  };
  criteria: Array<
    Omit<typeof aiJudgeCriteria.$inferInsert, "title" | "expectedBehavior"> & {
      title?: LocalizedText | SQL<unknown>;
      expectedBehavior?: LocalizedText | SQL<unknown>;
    }
  >;
  scoreGuidance: Array<
    Omit<typeof aiJudgeScoreGuidance.$inferInsert, "description" | "example"> & {
      description?: LocalizedText | SQL<unknown>;
      example?: LocalizedText | SQL<unknown> | null;
    }
  >;
  blockingErrors: Array<
    Omit<typeof aiJudgeBlockingErrors.$inferInsert, "description"> & {
      description?: LocalizedText | SQL<unknown>;
    }
  >;
};
