import type {
  AiJudgeConfigurationDraft,
  AiJudgeCriterionDraft,
  AiJudgeScoreGuidanceDraft,
} from "./aiJudgeConfiguration.types";

const createEmptyScoreGuidance = (score: number): AiJudgeScoreGuidanceDraft => ({
  score,
  description: "",
  example: "",
});

export const reconcileScoreGuidance = (
  maxScore: number,
  currentGuidance: AiJudgeScoreGuidanceDraft[],
): AiJudgeScoreGuidanceDraft[] => {
  const guidanceByScore = new Map(currentGuidance.map((item) => [item.score, item]));

  return Array.from({ length: maxScore + 1 }, (_, score) => {
    return guidanceByScore.get(score) ?? createEmptyScoreGuidance(score);
  });
};

export const isAiJudgeCriterionComplete = (criterion: AiJudgeCriterionDraft): boolean => {
  return (
    criterion.title.trim().length > 0 &&
    criterion.expectedBehavior.trim().length > 0 &&
    Number.isInteger(criterion.maxScore) &&
    criterion.maxScore > 0 &&
    criterion.scoreGuidance.length === criterion.maxScore + 1 &&
    criterion.scoreGuidance.every((guidance, score) => {
      return guidance.score === score && guidance.description.trim().length > 0;
    })
  );
};

export const createEmptyCriterion = (): AiJudgeCriterionDraft => ({
  title: "",
  expectedBehavior: "",
  maxScore: 1,
  scoreGuidance: reconcileScoreGuidance(1, []),
});

export const createEmptyAiJudgeConfiguration = (): AiJudgeConfigurationDraft => ({
  taskGoal: "",
  passingThresholdPercent: 70,
  criteria: [],
  blockingErrors: [],
});
