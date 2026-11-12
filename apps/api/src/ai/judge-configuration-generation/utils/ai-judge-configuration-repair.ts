import { AI_JUDGE_GENERATED_THRESHOLD_STEP } from "../ai-judge-configuration-generation.constants";
import { AI_JUDGE_VALIDATION_TARGET } from "../ai-judge-configuration-generation.types";

import type {
  AiJudgeValidationIssue,
  ReferencedAiJudgeConfiguration,
} from "../schemas/ai-judge-configuration-generation.schema";

// Repair findings define the editable scope. Preserve unrelated authored content even
// when a provider returns a complete, unnecessarily rewritten replacement.
export function preserveAiJudgeRepairScope(
  current: ReferencedAiJudgeConfiguration,
  generated: ReferencedAiJudgeConfiguration,
  issues: AiJudgeValidationIssue[],
): ReferencedAiJudgeConfiguration {
  const configurationTargets = issues.flatMap(({ target }) =>
    target.type === AI_JUDGE_VALIDATION_TARGET.CONFIGURATION ? [target] : [],
  );
  const canChange = (field: string) =>
    configurationTargets.some((target) => !target.field || target.field === field);

  return {
    taskGoal: canChange("taskGoal") ? generated.taskGoal : current.taskGoal,
    passingThresholdPercent: canChange("passingThresholdPercent")
      ? generated.passingThresholdPercent
      : current.passingThresholdPercent,
    criteria: canChange("criteria")
      ? generated.criteria
      : current.criteria.flatMap((criterion) => {
          const replacement = generated.criteria.find(({ ref }) => ref === criterion.ref);
          const criterionTargets = issues.flatMap(({ target }) =>
            target.type === AI_JUDGE_VALIDATION_TARGET.CRITERION && target.ref === criterion.ref
              ? [target]
              : [],
          );
          if (criterionTargets.some((target) => !target.field))
            return replacement ? [replacement] : [];
          if (!replacement) return [criterion];
          const canChangeCriterion = (field: string) =>
            criterionTargets.some((target) => target.field === field);

          return [
            {
              ...criterion,
              title: canChangeCriterion("title") ? replacement.title : criterion.title,
              expectedBehavior: canChangeCriterion("expectedBehavior")
                ? replacement.expectedBehavior
                : criterion.expectedBehavior,
              maxScore: canChangeCriterion("maxScore") ? replacement.maxScore : criterion.maxScore,
              scoreGuidance:
                canChangeCriterion("maxScore") || canChangeCriterion("scoreGuidance")
                  ? replacement.scoreGuidance
                  : criterion.scoreGuidance.map((guidance) => {
                      const updated = replacement.scoreGuidance.find(
                        ({ score }) => score === guidance.score,
                      );
                      if (!updated) return guidance;
                      const targets = issues.flatMap(({ target }) =>
                        target.type === AI_JUDGE_VALIDATION_TARGET.SCORE_GUIDANCE &&
                        target.ref === criterion.ref &&
                        target.score === guidance.score
                          ? [target]
                          : [],
                      );
                      return {
                        ...guidance,
                        description: targets.some(
                          (target) => !target.field || target.field === "description",
                        )
                          ? updated.description
                          : guidance.description,
                        example: targets.some(
                          (target) => !target.field || target.field === "example",
                        )
                          ? updated.example
                          : guidance.example,
                      };
                    }),
            },
          ];
        }),
    blockingErrors: canChange("blockingErrors")
      ? generated.blockingErrors
      : current.blockingErrors.flatMap((blockingError) => {
          const targets = issues.flatMap(({ target }) =>
            target.type === AI_JUDGE_VALIDATION_TARGET.BLOCKING_ERROR &&
            target.ref === blockingError.ref
              ? [target]
              : [],
          );
          const replacement = generated.blockingErrors.find(({ ref }) => ref === blockingError.ref);
          if (targets.some((target) => !target.field)) return replacement ? [replacement] : [];
          if (replacement && targets.some((target) => target.field === "description"))
            return [{ ...blockingError, description: replacement.description }];
          return [blockingError];
        }),
  };
}

export function normalizeGeneratedAiJudgeConfiguration(
  configuration: ReferencedAiJudgeConfiguration,
): ReferencedAiJudgeConfiguration {
  return {
    ...configuration,
    passingThresholdPercent:
      Math.round(configuration.passingThresholdPercent / AI_JUDGE_GENERATED_THRESHOLD_STEP) *
      AI_JUDGE_GENERATED_THRESHOLD_STEP,
  };
}
