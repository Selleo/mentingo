import { AI_JUDGE_CONTENT_VALIDATION_CODE } from "./ai-judge-configuration-content-validator.types";

import type { AiJudgeContentValidationIssue } from "./ai-judge-configuration-content-validator.types";
import type { AiJudgeConfigurationContent } from "./ai-judge-configuration.schema";

export const validateAiJudgeConfigurationContent = (
  configuration: AiJudgeConfigurationContent,
): AiJudgeContentValidationIssue[] => {
  const issues: AiJudgeContentValidationIssue[] = [];

  configuration.criteria.forEach((criterion, criterionIndex) => {
    const scoreCounts = new Map<number, number>();

    for (const guidance of criterion.scoreGuidance) {
      const count = (scoreCounts.get(guidance.score) ?? 0) + 1;
      scoreCounts.set(guidance.score, count);

      if (guidance.score < 0 || guidance.score > criterion.maxScore) {
        issues.push({
          code: AI_JUDGE_CONTENT_VALIDATION_CODE.GUIDANCE_SCORE_OUT_OF_RANGE,
          criterionIndex,
          score: guidance.score,
          maxScore: criterion.maxScore,
        });
      }

      if (count === 2) {
        issues.push({
          code: AI_JUDGE_CONTENT_VALIDATION_CODE.DUPLICATE_GUIDANCE_SCORE,
          criterionIndex,
          score: guidance.score,
        });
      }
    }

    const missingScores = Array.from(
      { length: criterion.maxScore + 1 },
      (_, score) => score,
    ).filter((score) => !scoreCounts.has(score));

    if (missingScores.length > 0) {
      issues.push({
        code: AI_JUDGE_CONTENT_VALIDATION_CODE.MISSING_GUIDANCE_SCORES,
        criterionIndex,
        missingScores,
      });
    }
  });

  return issues;
};
