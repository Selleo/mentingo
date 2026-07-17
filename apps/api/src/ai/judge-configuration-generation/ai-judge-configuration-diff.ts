import {
  AI_JUDGE_DRAFT_CHANGE_TYPE,
  AI_JUDGE_VALIDATION_TARGET,
} from "./ai-judge-configuration-generation.types";

import type {
  AiJudgeDraftChange,
  ReferencedAiJudgeConfiguration,
} from "./ai-judge-configuration-generation.schema";

type ChangeValue = string | number | null | undefined;

export const diffAiJudgeConfigurationDrafts = (
  before: ReferencedAiJudgeConfiguration,
  after: ReferencedAiJudgeConfiguration,
): AiJudgeDraftChange[] => {
  const changes: AiJudgeDraftChange[] = [];

  addChangedValue(
    changes,
    AI_JUDGE_VALIDATION_TARGET.CONFIGURATION,
    "taskGoal",
    before.taskGoal,
    after.taskGoal,
  );
  addChangedValue(
    changes,
    AI_JUDGE_VALIDATION_TARGET.CONFIGURATION,
    "passingThresholdPercent",
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
        field: "criterion",
        after: criterion.title,
      });
      continue;
    }

    addChangedValue(changes, criterion.ref, "title", previousCriterion.title, criterion.title);
    addChangedValue(
      changes,
      criterion.ref,
      "expectedBehavior",
      previousCriterion.expectedBehavior,
      criterion.expectedBehavior,
    );
    addChangedValue(
      changes,
      criterion.ref,
      "maxScore",
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
      field: "criterion",
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
        field: "scoreGuidance",
        after: guidance.description,
      });
      continue;
    }

    addChangedValue(
      changes,
      criterionRef,
      "description",
      previousGuidance.description,
      guidance.description,
      guidance.score,
    );
    addChangedValue(
      changes,
      criterionRef,
      "example",
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
      field: "scoreGuidance",
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
        field: "blockingError",
        after: blockingError.description,
      });
      continue;
    }

    addChangedValue(
      changes,
      blockingError.ref,
      "description",
      previousError.description,
      blockingError.description,
    );
  }

  for (const blockingError of before.blockingErrors) {
    if (afterErrorRefs.has(blockingError.ref)) continue;
    changes.push({
      type: AI_JUDGE_DRAFT_CHANGE_TYPE.REMOVED,
      targetRef: blockingError.ref,
      field: "blockingError",
      before: blockingError.description,
    });
  }
};

const addChangedValue = (
  changes: AiJudgeDraftChange[],
  targetRef: AiJudgeDraftChange["targetRef"],
  field: string,
  before: ChangeValue,
  after: ChangeValue,
  score?: number,
) => {
  if (before === after) return;
  changes.push({
    type: AI_JUDGE_DRAFT_CHANGE_TYPE.CHANGED,
    targetRef,
    ...(score === undefined ? {} : { score }),
    field,
    before,
    after,
  });
};
