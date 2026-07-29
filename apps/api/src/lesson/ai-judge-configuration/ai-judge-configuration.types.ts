import type { LocalizedText, SupportedLanguages } from "@repo/shared";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import type { UUIDType } from "src/common";
import type { CourseTranslationContext } from "src/courses/types/course.types";
import type {
  aiJudgeBlockingErrors,
  aiJudgeConfigurations,
  aiJudgeCriteria,
  aiJudgeScoreGuidance,
} from "src/storage/schema";

export type AiJudgeConfigurationGraph = {
  configuration: typeof aiJudgeConfigurations.$inferSelect;
  criteria: Array<typeof aiJudgeCriteria.$inferSelect>;
  scoreGuidance: Array<typeof aiJudgeScoreGuidance.$inferSelect>;
  blockingErrors: Array<typeof aiJudgeBlockingErrors.$inferSelect>;
};

export type AiJudgeLessonContext = {
  courseId: UUIDType;
  lessonId: UUIDType;
  lessonType: string;
  aiMentorLessonId: UUIDType | null;
  configurationId: UUIDType | null;
  baseLanguage: SupportedLanguages;
  availableLocales: SupportedLanguages[];
};

export type AiJudgeGenerationAuthoringContext = {
  courseId: UUIDType;
  baseLanguage: SupportedLanguages;
};

export type AiMentorLessonContext = Omit<AiJudgeLessonContext, "aiMentorLessonId"> & {
  aiMentorLessonId: UUIDType;
};

export type ConfiguredAiJudgeLessonContext = Omit<AiMentorLessonContext, "configurationId"> & {
  configurationId: UUIDType;
};

export type AiJudgeConfigurationLanguageRead = {
  id: UUIDType;
  aiMentorLessonId: UUIDType;
  taskGoal: string;
  passingThresholdPercent: number;
};

export type AiJudgeCriterionLanguageRead = {
  id: UUIDType;
  configurationId: UUIDType;
  title: string;
  expectedBehavior: string;
  maxScore: number;
};

export type AiJudgeScoreGuidanceLanguageRead = {
  id: UUIDType;
  criterionId: UUIDType;
  score: number;
  description: string;
  example: string;
};

export type AiJudgeBlockingErrorLanguageRead = {
  id: UUIDType;
  configurationId: UUIDType;
  description: string;
};

export type AiJudgeTranslationCandidateInput = {
  id: UUIDType;
  source: LocalizedText | null;
  field: AnyPgColumn;
  idColumn: AnyPgColumn;
  metadata: string;
  context: CourseTranslationContext;
};
