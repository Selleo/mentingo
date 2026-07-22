export { LESSON_TYPES, type LessonTypes } from "@repo/shared";

import type { SupportedLanguages } from "@repo/shared";
import type { AiJudgeCriterionStatus } from "src/ai/judge-configuration/judge-configuration.types";
import type { UUIDType } from "src/common";

export type AiMentorEvaluationDetails = {
  minScore: number | null;
  maxScore: number | null;
  score: number | null;
  percentage: number | null;
  requiredScore: number | null;
  passed: boolean | null;
  criteria: Array<{
    criterionId: UUIDType | null;
    title: string;
    awardedScore: number;
    maxScore: number;
    status: AiJudgeCriterionStatus;
    learnerSafeFeedback: string;
  }>;
  blockingErrors: Array<{
    blockingErrorId: UUIDType | null;
    description: string;
    learnerSafeFeedback: string;
  }>;
};

export type CreateLiveLessonInput = {
  lessonId: UUIDType;
  liveTrainingId: UUIDType;
  liveTrainingLinkId: UUIDType;
  language: SupportedLanguages;
};

export type EmbedLessonResourceType = {
  id: string;
  reference: string;
  contentType: string;
  metadata: {
    allowFullscreen: boolean;
  };
};
