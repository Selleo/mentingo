import {
  AI_JUDGE_DRAFT_CHANGE_FIELD,
  AI_JUDGE_DRAFT_CHANGE_TYPE,
  AI_JUDGE_VALIDATION_TARGET,
} from "../ai-judge-configuration-generation.types";

import type {
  AiJudgeDraftChange,
  ReferencedAiJudgeConfiguration,
} from "../schemas/ai-judge-configuration-generation.schema";

type ChangeValue = string | number | null | undefined;

const normalizeComparableValue = (value: ChangeValue) => {
  if (typeof value !== "string") return value;
  return value.trim().replace(/\s+/g, " ");
};

export const diffAiJudgeConfigurationDrafts = (
  before: ReferencedAiJudgeConfiguration,
  after: ReferencedAiJudgeConfiguration,
): AiJudgeDraftChange[] => {
  const changes: AiJudgeDraftChange[] = [];

  addChangedValue(
    changes,
    AI_JUDGE_VALIDATION_TARGET.CONFIGURATION,
    AI_JUDGE_DRAFT_CHANGE_FIELD.TASK_GOAL,
    before.taskGoal,
    after.taskGoal,
  );
  addChangedValue(
    changes,
    AI_JUDGE_VALIDATION_TARGET.CONFIGURATION,
    AI_JUDGE_DRAFT_CHANGE_FIELD.PASSING_THRESHOLD_PERCENT,
    before.passingThresholdPercent,
    after.passingThresholdPercent,
  );
  addCriterionChanges(changes, before, after);
  addBlockingErrorChanges(changes, before, after);

  return changes;
};

const addCriterionChanges = (
  changes: AiJudgeDraftChange[],
  before: ReferencedAiJudgeConfiguration,
  after: ReferencedAiJudgeConfiguration,
) => {
  const beforeCriteria = new Map(before.criteria.map((criterion) => [criterion.ref, criterion]));
  const afterCriterionRefs = new Set(after.criteria.map(({ ref }) => ref));

  for (const criterion of after.criteria) {
    const previousCriterion = beforeCriteria.get(criterion.ref);
    if (!previousCriterion) {
      changes.push({
        type: AI_JUDGE_DRAFT_CHANGE_TYPE.ADDED,
        targetRef: criterion.ref,
        field: AI_JUDGE_DRAFT_CHANGE_FIELD.CRITERION,
        after: criterion.title,
      });
      continue;
    }

    addChangedValue(
      changes,
      criterion.ref,
      AI_JUDGE_DRAFT_CHANGE_FIELD.TITLE,
      previousCriterion.title,
      criterion.title,
    );
    addChangedValue(
      changes,
      criterion.ref,
      AI_JUDGE_DRAFT_CHANGE_FIELD.EXPECTED_BEHAVIOR,
      previousCriterion.expectedBehavior,
      criterion.expectedBehavior,
    );
    addChangedValue(
      changes,
      criterion.ref,
      AI_JUDGE_DRAFT_CHANGE_FIELD.MAX_SCORE,
      previousCriterion.maxScore,
      criterion.maxScore,
    );
    addScoreGuidanceChanges(changes, criterion.ref, previousCriterion, criterion);
  }

  for (const criterion of before.criteria) {
    if (afterCriterionRefs.has(criterion.ref)) continue;
    changes.push({
      type: AI_JUDGE_DRAFT_CHANGE_TYPE.REMOVED,
      targetRef: criterion.ref,
      field: AI_JUDGE_DRAFT_CHANGE_FIELD.CRITERION,
      before: criterion.title,
    });
  }
};

const addScoreGuidanceChanges = (
  changes: AiJudgeDraftChange[],
  criterionRef: string,
  before: ReferencedAiJudgeConfiguration["criteria"][number],
  after: ReferencedAiJudgeConfiguration["criteria"][number],
) => {
  const beforeGuidance = new Map(
    before.scoreGuidance.map((guidance) => [guidance.score, guidance]),
  );
  const afterScores = new Set(after.scoreGuidance.map(({ score }) => score));

  for (const guidance of after.scoreGuidance) {
    const previousGuidance = beforeGuidance.get(guidance.score);
    if (!previousGuidance) {
      changes.push({
        type: AI_JUDGE_DRAFT_CHANGE_TYPE.ADDED,
        targetRef: criterionRef,
        score: guidance.score,
        field: AI_JUDGE_DRAFT_CHANGE_FIELD.SCORE_GUIDANCE,
        after: guidance.description,
      });
      continue;
    }

    addChangedValue(
      changes,
      criterionRef,
      AI_JUDGE_DRAFT_CHANGE_FIELD.DESCRIPTION,
      previousGuidance.description,
      guidance.description,
      guidance.score,
    );
    addChangedValue(
      changes,
      criterionRef,
      AI_JUDGE_DRAFT_CHANGE_FIELD.EXAMPLE,
      previousGuidance.example ?? null,
      guidance.example ?? null,
      guidance.score,
    );
  }

  for (const guidance of before.scoreGuidance) {
    if (afterScores.has(guidance.score)) continue;
    changes.push({
      type: AI_JUDGE_DRAFT_CHANGE_TYPE.REMOVED,
      targetRef: criterionRef,
      score: guidance.score,
      field: AI_JUDGE_DRAFT_CHANGE_FIELD.SCORE_GUIDANCE,
      before: guidance.description,
    });
  }
};

const addBlockingErrorChanges = (
  changes: AiJudgeDraftChange[],
  before: ReferencedAiJudgeConfiguration,
  after: ReferencedAiJudgeConfiguration,
) => {
  const beforeErrors = new Map(before.blockingErrors.map((error) => [error.ref, error]));
  const afterErrorRefs = new Set(after.blockingErrors.map(({ ref }) => ref));

  for (const blockingError of after.blockingErrors) {
    const previousError = beforeErrors.get(blockingError.ref);
    if (!previousError) {
      changes.push({
        type: AI_JUDGE_DRAFT_CHANGE_TYPE.ADDED,
        targetRef: blockingError.ref,
        field: AI_JUDGE_DRAFT_CHANGE_FIELD.BLOCKING_ERROR,
        after: blockingError.description,
      });
      continue;
    }

    addChangedValue(
      changes,
      blockingError.ref,
      AI_JUDGE_DRAFT_CHANGE_FIELD.DESCRIPTION,
      previousError.description,
      blockingError.description,
    );
  }

  for (const blockingError of before.blockingErrors) {
    if (afterErrorRefs.has(blockingError.ref)) continue;
    changes.push({
      type: AI_JUDGE_DRAFT_CHANGE_TYPE.REMOVED,
      targetRef: blockingError.ref,
      field: AI_JUDGE_DRAFT_CHANGE_FIELD.BLOCKING_ERROR,
      before: blockingError.description,
    });
  }
};

const addChangedValue = (
  changes: AiJudgeDraftChange[],
  targetRef: AiJudgeDraftChange["targetRef"],
  field: AiJudgeDraftChange["field"],
  before: ChangeValue,
  after: ChangeValue,
  score?: number,
) => {
  if (normalizeComparableValue(before) === normalizeComparableValue(after)) return;
  changes.push({
    type: AI_JUDGE_DRAFT_CHANGE_TYPE.CHANGED,
    targetRef,
    ...(score === undefined ? {} : { score }),
    field,
    before,
    after,
  });
};
