import { AI_JUDGE_CRITERION_STATUS } from "src/ai/judge-configuration/judge-configuration.types";

import type {
  AiJudgeCriterionStatus,
  AiJudgeModelResult,
  AiJudgeRubric,
  EvaluatedAiJudgeResult,
} from "src/ai/judge-configuration/judge-configuration.types";

export const evaluateAiJudgeResult = (
  result: AiJudgeModelResult,
  rubric: AiJudgeRubric,
): EvaluatedAiJudgeResult => {
  const configuredCriteria = new Map(
    rubric.criteria.map((criterion, index) => [`C${index + 1}`, criterion]),
  );
  const returnedCriterionRefs = new Set<string>();

  if (result.criterionResults.length !== rubric.criteria.length)
    throw new Error("AI Judge returned an incomplete criterion result set");

  for (const criterionResult of result.criterionResults) {
    const configuredCriterion = configuredCriteria.get(criterionResult.criterionRef);
    if (!configuredCriterion || returnedCriterionRefs.has(criterionResult.criterionRef))
      throw new Error("AI Judge returned an unknown or duplicate criterion reference");
    if (criterionResult.awardedScore > configuredCriterion.maxScore)
      throw new Error("AI Judge awarded a score outside the configured range");
    returnedCriterionRefs.add(criterionResult.criterionRef);
  }

  const configuredBlockingErrors = new Map(
    rubric.blockingErrors.map((blockingError, index) => [`B${index + 1}`, blockingError]),
  );
  const returnedBlockingErrorRefs = new Set<string>();
  for (const blockingError of result.triggeredBlockingErrors) {
    if (
      !configuredBlockingErrors.has(blockingError.blockingErrorRef) ||
      returnedBlockingErrorRefs.has(blockingError.blockingErrorRef)
    )
      throw new Error("AI Judge returned an unknown or duplicate blocking-error reference");
    returnedBlockingErrorRefs.add(blockingError.blockingErrorRef);
  }

  const modelResults = new Map(
    result.criterionResults.map((criterion) => [criterion.criterionRef, criterion]),
  );
  const criteria = rubric.criteria.map((criterion, index) => {
    const modelResult = modelResults.get(`C${index + 1}`);
    if (!modelResult) throw new Error("AI Judge omitted a configured criterion");
    const awardedScore = modelResult.awardedScore;
    let status: AiJudgeCriterionStatus = AI_JUDGE_CRITERION_STATUS.NOT_MET;
    if (awardedScore === criterion.maxScore) status = AI_JUDGE_CRITERION_STATUS.MET;
    else if (awardedScore > 0) status = AI_JUDGE_CRITERION_STATUS.PARTIAL;

    return {
      criterionId: criterion.id,
      title: criterion.title,
      awardedScore,
      maxScore: criterion.maxScore,
      status,
      learnerSafeFeedback: modelResult.learnerSafeFeedback,
    };
  });
  const blockingErrors = result.triggeredBlockingErrors.map((blockingError) => {
    const configuredBlockingError = configuredBlockingErrors.get(blockingError.blockingErrorRef);
    if (!configuredBlockingError) throw new Error("AI Judge returned an unknown blocking error");

    return {
      blockingErrorId: configuredBlockingError.id,
      description: configuredBlockingError.description,
      learnerSafeFeedback: blockingError.learnerSafeFeedback,
    };
  });
  const score = criteria.reduce((total, criterion) => total + criterion.awardedScore, 0);
  const maxScore = rubric.criteria.reduce((total, criterion) => total + criterion.maxScore, 0);
  const minScore = Math.ceil((maxScore * rubric.passingThresholdPercent) / 100);
  const percentage = maxScore > 0 ? Math.ceil((score / maxScore) * 100) : 100;
  const passed = score >= minScore && blockingErrors.length === 0;

  return {
    minScore,
    score,
    maxScore,
    percentage,
    passed,
    criteria,
    blockingErrors,
  };
};
