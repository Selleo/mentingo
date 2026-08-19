export const AI_MENTOR_EVALUATION_CONTEXT = {
  LESSON: "lesson",
  PRACTICE: "practice",
} as const;

export type AiMentorEvaluationContext =
  (typeof AI_MENTOR_EVALUATION_CONTEXT)[keyof typeof AI_MENTOR_EVALUATION_CONTEXT];

export type AiMentorEvaluation = {
  passed?: boolean | null;
  minScore?: number | null;
  score?: number | null;
  maxScore?: number | null;
  percentage?: number | null;
  requiredScore?: number | null;
  criteria?: Array<{
    criterionId: string | null;
    title: string;
    awardedScore: number;
    maxScore: number;
    status: string;
    learnerSafeFeedback: string;
  }>;
  blockingErrors?: Array<{
    blockingErrorId: string | null;
    description: string;
    learnerSafeFeedback: string;
  }>;
};
