export const AI_JUDGE_CONTENT_VALIDATION_CODE = {
  GUIDANCE_SCORE_OUT_OF_RANGE: "guidance_score_out_of_range",
  DUPLICATE_GUIDANCE_SCORE: "duplicate_guidance_score",
  MISSING_GUIDANCE_SCORES: "missing_guidance_scores",
  DUPLICATE_CRITERION_REF: "duplicate_criterion_ref",
  DUPLICATE_BLOCKING_ERROR_REF: "duplicate_blocking_error_ref",
  INVALID_NEW_CRITERION_REF: "invalid_new_criterion_ref",
  INVALID_NEW_BLOCKING_ERROR_REF: "invalid_new_blocking_error_ref",
} as const;

export type AiJudgeContentValidationIssue =
  | {
      code: typeof AI_JUDGE_CONTENT_VALIDATION_CODE.GUIDANCE_SCORE_OUT_OF_RANGE;
      criterionIndex: number;
      score: number;
      maxScore: number;
    }
  | {
      code: typeof AI_JUDGE_CONTENT_VALIDATION_CODE.DUPLICATE_GUIDANCE_SCORE;
      criterionIndex: number;
      score: number;
    }
  | {
      code: typeof AI_JUDGE_CONTENT_VALIDATION_CODE.MISSING_GUIDANCE_SCORES;
      criterionIndex: number;
      missingScores: number[];
    };
