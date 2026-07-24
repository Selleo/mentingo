import {
  AI_JUDGE_GENERATION_MAX_ATTEMPTS,
  AI_JUDGE_GENERATION_STATUS,
  AI_JUDGE_DRAFT_CHANGE_FIELD,
  AI_JUDGE_VALIDATION_TARGET,
  AI_JUDGE_VALIDATION_SEVERITY,
} from "@repo/shared";

import { formatHtmlString } from "~/lib/formatters/formatHtmlString";

import { AI_JUDGE_GENERATION_CHECK_STATUS } from "./aiJudgeConfiguration.types";
import {
  getLocalizedAiJudgeValidationIssueText,
  getLocalizedAiJudgeValidationSummary,
} from "./aiJudgeValidationLocalization";

import type {
  AiJudgeConfigurationDraft,
  AiJudgeGenerationCheck,
  AiJudgeGenerationChange,
  AiJudgeGenerationAttempt,
  AiJudgeGenerationViewState,
} from "./aiJudgeConfiguration.types";
import type { TFunction } from "i18next";
import type { GetGenerationResponse } from "~/api/generated-api";

export type AiJudgeGenerationSnapshot = GetGenerationResponse["data"];
type AiJudgeGenerationProgress = AiJudgeGenerationSnapshot["progress"];
type GeneratedConfiguration = Extract<
  AiJudgeGenerationProgress,
  { status: typeof AI_JUDGE_GENERATION_STATUS.COMPLETED }
>["configuration"];
type GeneratedValidation = Extract<
  AiJudgeGenerationProgress,
  { status: typeof AI_JUDGE_GENERATION_STATUS.COMPLETED }
>["validation"];

const TARGET_LABEL_MAX_LENGTH = 80;

const getTargetIndex = (ref: string) => {
  const index = Number(ref.slice(1)) - 1;
  return Number.isInteger(index) && index >= 0 ? index : undefined;
};

const shortenTargetLabel = (value: string) => {
  const normalized = formatHtmlString(value);
  if (normalized.length <= TARGET_LABEL_MAX_LENGTH) return normalized;
  return `${normalized.slice(0, TARGET_LABEL_MAX_LENGTH - 1).trimEnd()}…`;
};

const getReferenceLabel = (
  reference: string,
  configuration: GeneratedConfiguration | undefined,
  t: TFunction,
) => {
  const targetIndex = getTargetIndex(reference);
  if (targetIndex === undefined) return reference;

  if (reference.startsWith("C")) {
    return (
      configuration?.criteria[targetIndex]?.title ??
      t("adminCourseView.curriculum.lesson.aiJudge.generation.target.criterion")
    );
  }

  if (reference.startsWith("B")) {
    const description = configuration?.blockingErrors[targetIndex]?.description;
    return description
      ? shortenTargetLabel(description)
      : t("adminCourseView.curriculum.lesson.aiJudge.generation.target.blockingError");
  }

  return reference;
};

const replaceInternalReferences = (
  value: string,
  configuration: GeneratedConfiguration | undefined,
  t: TFunction,
) => value.replace(/\b[CB]\d+\b/g, (reference) => getReferenceLabel(reference, configuration, t));

const getValidationConcern = (
  firstConcern: GeneratedValidation["issues"][number] | undefined,
  validation: GeneratedValidation | undefined,
  t: TFunction,
) => {
  if (firstConcern) return getLocalizedAiJudgeValidationIssueText(firstConcern, t).correction;
  if (validation) return getLocalizedAiJudgeValidationSummary(validation, t);
  return undefined;
};

const getValidationTargetContext = (
  target: GeneratedValidation["issues"][number]["target"],
  configuration: GeneratedConfiguration | undefined,
  t: TFunction,
): Pick<
  AiJudgeGenerationCheck,
  "targetLabel" | "targetRef" | "targetScore" | "targetTypeLabel"
> => {
  switch (target.type) {
    case AI_JUDGE_VALIDATION_TARGET.CONFIGURATION:
      return {
        targetTypeLabel: t(
          "adminCourseView.curriculum.lesson.aiJudge.generation.target.assessment",
        ),
      };
    case AI_JUDGE_VALIDATION_TARGET.CRITERION:
    case AI_JUDGE_VALIDATION_TARGET.SCORE_GUIDANCE: {
      const targetIndex = getTargetIndex(target.ref);
      const criterion =
        targetIndex === undefined ? undefined : configuration?.criteria[targetIndex];

      let targetTypeLabelKey =
        "adminCourseView.curriculum.lesson.aiJudge.generation.target.criterion";
      if (target.field === AI_JUDGE_DRAFT_CHANGE_FIELD.TITLE)
        targetTypeLabelKey = "adminCourseView.curriculum.lesson.aiJudge.criterionTitle";
      if (target.field === AI_JUDGE_DRAFT_CHANGE_FIELD.EXPECTED_BEHAVIOR)
        targetTypeLabelKey = "adminCourseView.curriculum.lesson.aiJudge.expectedBehavior";
      if (target.type === AI_JUDGE_VALIDATION_TARGET.SCORE_GUIDANCE)
        targetTypeLabelKey =
          target.field === AI_JUDGE_DRAFT_CHANGE_FIELD.EXAMPLE
            ? "adminCourseView.curriculum.lesson.aiJudge.acceptedExample"
            : "adminCourseView.curriculum.lesson.aiJudge.scoreDescription";

      const targetContext = {
        targetRef: target.ref,
        targetTypeLabel: t(targetTypeLabelKey),
        targetLabel: criterion?.title,
      };
      if (target.type !== AI_JUDGE_VALIDATION_TARGET.SCORE_GUIDANCE) return targetContext;

      return { ...targetContext, targetScore: target.score };
    }
    case AI_JUDGE_VALIDATION_TARGET.BLOCKING_ERROR: {
      const targetIndex = getTargetIndex(target.ref);
      const blockingError =
        targetIndex === undefined ? undefined : configuration?.blockingErrors[targetIndex];

      return {
        targetRef: target.ref,
        targetTypeLabel: t(
          "adminCourseView.curriculum.lesson.aiJudge.generation.target.blockingError",
        ),
        targetLabel: blockingError?.description,
      };
    }
  }
};

export const mapGeneratedAiJudgeConfigurationToDraft = (
  configuration: GeneratedConfiguration,
): AiJudgeConfigurationDraft => ({
  taskGoal: configuration.taskGoal,
  passingThresholdPercent: configuration.passingThresholdPercent,
  criteria: configuration.criteria.map((criterion) => ({
    id: criterion.id,
    title: criterion.title,
    expectedBehavior: criterion.expectedBehavior,
    maxScore: criterion.maxScore,
    scoreGuidance: criterion.scoreGuidance.map((guidance) => ({
      id: guidance.id,
      score: guidance.score,
      description: guidance.description,
      example: guidance.example ?? undefined,
    })),
  })),
  blockingErrors: configuration.blockingErrors.map((blockingError) => ({
    id: blockingError.id,
    description: blockingError.description,
  })),
});

const mapValidationToChecks = (
  validation: GeneratedValidation | undefined,
  configuration: GeneratedConfiguration | undefined,
  t: TFunction,
): AiJudgeGenerationCheck[] => {
  if (!validation) return [];

  if (validation.issues.length === 0) {
    return [
      {
        id: "validation-summary",
        label: validation.summary,
        status: validation.passed
          ? AI_JUDGE_GENERATION_CHECK_STATUS.PASSED
          : AI_JUDGE_GENERATION_CHECK_STATUS.NEEDS_ATTENTION,
      },
    ];
  }

  return validation.issues.map((issue, index) => {
    const isPassingWarning =
      issue.severity === AI_JUDGE_VALIDATION_SEVERITY.WARNING && validation.passed;

    const targetContext = getValidationTargetContext(issue.target, configuration, t);
    const issueText = getLocalizedAiJudgeValidationIssueText(issue, t);

    return {
      id: `${issue.code}-${index}`,
      label: replaceInternalReferences(issueText.message, configuration, t),
      detail: replaceInternalReferences(issueText.correction, configuration, t),
      ...targetContext,
      status: isPassingWarning
        ? AI_JUDGE_GENERATION_CHECK_STATUS.PASSED
        : AI_JUDGE_GENERATION_CHECK_STATUS.NEEDS_ATTENTION,
    };
  });
};

const getChangeTargetContext = (
  change: AiJudgeGenerationChange,
  configuration: GeneratedConfiguration | undefined,
  t: TFunction,
): Pick<AiJudgeGenerationChange, "targetLabel" | "targetTypeLabel"> => {
  if (change.targetRef === "configuration") {
    return {
      targetTypeLabel: t("adminCourseView.curriculum.lesson.aiJudge.generation.target.assessment"),
    };
  }

  const targetIndex = getTargetIndex(change.targetRef);
  if (change.targetRef.startsWith("B")) {
    const description =
      targetIndex === undefined
        ? undefined
        : configuration?.blockingErrors[targetIndex]?.description;
    const fallbackDescription = typeof change.after === "string" ? change.after : change.before;
    return {
      targetTypeLabel: t(
        "adminCourseView.curriculum.lesson.aiJudge.generation.target.blockingError",
      ),
      targetLabel:
        description ??
        (typeof fallbackDescription === "string"
          ? shortenTargetLabel(fallbackDescription)
          : undefined),
    };
  }

  const criterion = targetIndex === undefined ? undefined : configuration?.criteria[targetIndex];
  return {
    targetTypeLabel: t(
      change.score === undefined
        ? "adminCourseView.curriculum.lesson.aiJudge.generation.target.criterion"
        : "adminCourseView.curriculum.lesson.aiJudge.generation.target.scoreGuidance",
    ),
    targetLabel:
      criterion?.title ??
      (change.field === AI_JUDGE_DRAFT_CHANGE_FIELD.CRITERION &&
      typeof (change.after ?? change.before) === "string"
        ? String(change.after ?? change.before)
        : undefined),
  };
};

const mapChanges = (
  changes: AiJudgeGenerationChange[],
  configuration: GeneratedConfiguration | undefined,
  t: TFunction,
) =>
  changes.map((change) => ({
    ...change,
    ...getChangeTargetContext(change, configuration, t),
  }));

const getGeneratedConfiguration = (
  progress: AiJudgeGenerationProgress,
): GeneratedConfiguration | undefined => {
  switch (progress.status) {
    case AI_JUDGE_GENERATION_STATUS.EVALUATING:
    case AI_JUDGE_GENERATION_STATUS.REVISING:
      return progress.draft;
    case AI_JUDGE_GENERATION_STATUS.COMPLETED:
    case AI_JUDGE_GENERATION_STATUS.AWAITING_REVISION:
    case AI_JUDGE_GENERATION_STATUS.REQUIRES_REVIEW:
    case AI_JUDGE_GENERATION_STATUS.FAILED:
    case AI_JUDGE_GENERATION_STATUS.CANCELLED:
      return progress.configuration;
    case AI_JUDGE_GENERATION_STATUS.DRAFTING:
      return undefined;
  }
};

const getGeneratedValidation = (
  progress: AiJudgeGenerationProgress,
): GeneratedValidation | undefined => {
  switch (progress.status) {
    case AI_JUDGE_GENERATION_STATUS.REVISING:
    case AI_JUDGE_GENERATION_STATUS.AWAITING_REVISION:
    case AI_JUDGE_GENERATION_STATUS.COMPLETED:
    case AI_JUDGE_GENERATION_STATUS.REQUIRES_REVIEW:
      return progress.validation;
    case AI_JUDGE_GENERATION_STATUS.DRAFTING:
    case AI_JUDGE_GENERATION_STATUS.EVALUATING:
    case AI_JUDGE_GENERATION_STATUS.FAILED:
    case AI_JUDGE_GENERATION_STATUS.CANCELLED:
      return undefined;
  }
};

const getGeneratedChanges = (progress: AiJudgeGenerationProgress): AiJudgeGenerationChange[] => {
  switch (progress.status) {
    case AI_JUDGE_GENERATION_STATUS.EVALUATING:
    case AI_JUDGE_GENERATION_STATUS.REVISING:
    case AI_JUDGE_GENERATION_STATUS.AWAITING_REVISION:
    case AI_JUDGE_GENERATION_STATUS.COMPLETED:
    case AI_JUDGE_GENERATION_STATUS.REQUIRES_REVIEW:
      return progress.changes ?? [];
    case AI_JUDGE_GENERATION_STATUS.DRAFTING:
    case AI_JUDGE_GENERATION_STATUS.FAILED:
    case AI_JUDGE_GENERATION_STATUS.CANCELLED:
      return [];
  }
};

const getCompletedArtifacts = (progress: AiJudgeGenerationProgress, t: TFunction): string[] => {
  if (!getGeneratedConfiguration(progress)) return [];

  return [
    t("adminCourseView.curriculum.lesson.aiJudge.generation.artifacts.taskGoal"),
    t("adminCourseView.curriculum.lesson.aiJudge.generation.artifacts.criteria"),
    t("adminCourseView.curriculum.lesson.aiJudge.generation.artifacts.threshold"),
    t("adminCourseView.curriculum.lesson.aiJudge.generation.artifacts.blockingErrors"),
  ];
};

const mapAttemptHistory = (
  progress: AiJudgeGenerationProgress,
  configuration: GeneratedConfiguration | undefined,
  t: TFunction,
): AiJudgeGenerationAttempt[] =>
  progress.attemptHistory.map(({ attempt, changes, validation }) => ({
    attempt,
    passed: validation.passed,
    summary: replaceInternalReferences(
      getLocalizedAiJudgeValidationSummary(validation, t),
      configuration,
      t,
    ),
    corrections: validation.issues.map((issue) =>
      replaceInternalReferences(
        getLocalizedAiJudgeValidationIssueText(issue, t).correction,
        configuration,
        t,
      ),
    ),
    changes: mapChanges(changes, configuration, t),
  }));

export const mapAiJudgeGenerationSnapshotToViewState = (
  snapshot: AiJudgeGenerationSnapshot,
  t: TFunction,
): AiJudgeGenerationViewState => {
  const { progress } = snapshot;
  const configuration = getGeneratedConfiguration(progress);
  const validation = getGeneratedValidation(progress);
  const firstConcern = validation?.issues.find(
    (issue) => issue.severity === AI_JUDGE_VALIDATION_SEVERITY.ERROR,
  );
  const humanizedFirstCorrection = firstConcern
    ? replaceInternalReferences(
        getLocalizedAiJudgeValidationIssueText(firstConcern, t).correction,
        configuration,
        t,
      )
    : undefined;
  const validationConcern = getValidationConcern(firstConcern, validation, t);
  const humanizedValidationConcern = validationConcern
    ? replaceInternalReferences(validationConcern, configuration, t)
    : undefined;

  return {
    status: progress.status,
    attempt: progress.attempt,
    maxAttempts: AI_JUDGE_GENERATION_MAX_ATTEMPTS,
    completedArtifacts: getCompletedArtifacts(progress, t),
    evaluatorChecks: mapValidationToChecks(validation, configuration, t),
    changes: mapChanges(getGeneratedChanges(progress), configuration, t),
    attemptHistory: mapAttemptHistory(progress, configuration, t),
    currentCorrection:
      progress.status === AI_JUDGE_GENERATION_STATUS.REVISING
        ? humanizedFirstCorrection
        : undefined,
    remainingConcern:
      progress.status === AI_JUDGE_GENERATION_STATUS.REQUIRES_REVIEW
        ? humanizedValidationConcern
        : undefined,
    draft: configuration && mapGeneratedAiJudgeConfigurationToDraft(configuration),
  };
};
