import { validateAiJudgeConfigurationContent } from "src/lesson/ai-judge-configuration/ai-judge-configuration-content-validator";
import { AI_JUDGE_CONTENT_VALIDATION_CODE } from "src/lesson/ai-judge-configuration/ai-judge-configuration-content-validator.types";

import { AI_JUDGE_CONFIGURATION_VALIDATOR_MAX_ISSUES } from "../ai-judge-configuration-generation.constants";
import {
  AI_JUDGE_VALIDATION_SEVERITY,
  AI_JUDGE_VALIDATION_TARGET,
} from "../ai-judge-configuration-generation.types";

import type { AiJudgeReferencePrefix } from "../ai-judge-configuration-generation.types";
import type {
  AiJudgeConfigurationValidationResult,
  AiJudgeValidationIssue,
  GeneratedAiJudgeConfiguration,
  ReferencedAiJudgeConfiguration,
} from "../schemas/ai-judge-configuration-generation.schema";
import type { AiJudgeContentValidationIssue } from "src/lesson/ai-judge-configuration/ai-judge-configuration-content-validator.types";

export const stripAiJudgeConfigurationReferences = (
  configuration: ReferencedAiJudgeConfiguration,
): GeneratedAiJudgeConfiguration => ({
  ...configuration,
  criteria: configuration.criteria.map(({ ref: _ref, ...criterion }) => criterion),
  blockingErrors: configuration.blockingErrors.map(
    ({ ref: _ref, ...blockingError }) => blockingError,
  ),
});

export const normalizeDuplicateAiJudgeConfigurationReferences = (
  configuration: ReferencedAiJudgeConfiguration,
  previousConfiguration?: ReferencedAiJudgeConfiguration,
): ReferencedAiJudgeConfiguration => ({
  ...configuration,
  criteria: normalizeDuplicateReferences(
    configuration.criteria,
    "C",
    previousConfiguration?.criteria.map(({ ref }) => ref),
  ),
  blockingErrors: normalizeDuplicateReferences(
    configuration.blockingErrors,
    "B",
    previousConfiguration?.blockingErrors.map(({ ref }) => ref),
  ),
});

export const validateReferencedAiJudgeConfiguration = (
  configuration: ReferencedAiJudgeConfiguration,
): AiJudgeValidationIssue[] => [
  ...findDuplicateReferences(configuration),
  ...validateAiJudgeConfigurationContent(configuration).map((issue) =>
    mapContentIssue(configuration, issue),
  ),
];

export const validateAiJudgeReferenceTransition = (
  before: ReferencedAiJudgeConfiguration | undefined,
  after: ReferencedAiJudgeConfiguration,
): AiJudgeValidationIssue[] => [
  ...validateNewReferences(
    before?.criteria.map(({ ref }) => ref) ?? [],
    after.criteria.map(({ ref }) => ref),
    "C",
  ),
  ...validateNewReferences(
    before?.blockingErrors.map(({ ref }) => ref) ?? [],
    after.blockingErrors.map(({ ref }) => ref),
    "B",
  ),
];

export const getDeterministicAiJudgeConfigurationValidation = (
  before: ReferencedAiJudgeConfiguration | undefined,
  after: ReferencedAiJudgeConfiguration,
): AiJudgeConfigurationValidationResult | undefined => {
  const issues = [
    ...validateAiJudgeReferenceTransition(before, after),
    ...validateReferencedAiJudgeConfiguration(after),
  ];
  if (issues.length === 0) return undefined;

  return {
    passed: false,
    summary: "The generated assessment structure needs correction.",
    issues: issues.slice(0, AI_JUDGE_CONFIGURATION_VALIDATOR_MAX_ISSUES),
  };
};

const findDuplicateReferences = (
  configuration: ReferencedAiJudgeConfiguration,
): AiJudgeValidationIssue[] => {
  const issues: AiJudgeValidationIssue[] = [];
  const criterionRefs = new Set<string>();
  const blockingErrorRefs = new Set<string>();

  configuration.criteria.forEach(({ ref }) => {
    if (criterionRefs.has(ref)) {
      issues.push({
        code: AI_JUDGE_CONTENT_VALIDATION_CODE.DUPLICATE_CRITERION_REF,
        severity: AI_JUDGE_VALIDATION_SEVERITY.ERROR,
        target: { type: AI_JUDGE_VALIDATION_TARGET.CRITERION, ref },
        message: `Criterion reference ${ref} is duplicated.`,
        correction: `Give every criterion one unique C-number reference while preserving existing references.`,
      });
    }
    criterionRefs.add(ref);
  });

  configuration.blockingErrors.forEach(({ ref }) => {
    if (blockingErrorRefs.has(ref)) {
      issues.push({
        code: AI_JUDGE_CONTENT_VALIDATION_CODE.DUPLICATE_BLOCKING_ERROR_REF,
        severity: AI_JUDGE_VALIDATION_SEVERITY.ERROR,
        target: { type: AI_JUDGE_VALIDATION_TARGET.BLOCKING_ERROR, ref },
        message: `Blocking-error reference ${ref} is duplicated.`,
        correction: `Give every blocking error one unique B-number reference while preserving existing references.`,
      });
    }
    blockingErrorRefs.add(ref);
  });

  return issues;
};

const validateNewReferences = (
  beforeReferences: string[],
  afterReferences: string[],
  prefix: AiJudgeReferencePrefix,
): AiJudgeValidationIssue[] => {
  const existingReferences = new Set(beforeReferences);
  const newReferences = afterReferences.filter((ref) => !existingReferences.has(ref));
  if (newReferences.length === 0) return [];

  const highestExistingNumber = beforeReferences.reduce(
    (highest, ref) => Math.max(highest, Number(ref.slice(1))),
    0,
  );
  const expectedReferences = Array.from(
    { length: newReferences.length },
    (_, index) => `${prefix}${highestExistingNumber + index + 1}`,
  );
  const expectedReferenceSet = new Set(expectedReferences);
  const invalidReference = newReferences.find((ref) => !expectedReferenceSet.has(ref));
  if (!invalidReference) return [];

  const isCriterion = prefix === "C";
  const targetType = isCriterion
    ? AI_JUDGE_VALIDATION_TARGET.CRITERION
    : AI_JUDGE_VALIDATION_TARGET.BLOCKING_ERROR;
  const referenceLabel = isCriterion ? "criterion" : "blocking-error";
  const referenceCollectionLabel = isCriterion ? "criteria" : "blocking errors";

  return [
    {
      code: isCriterion
        ? AI_JUDGE_CONTENT_VALIDATION_CODE.INVALID_NEW_CRITERION_REF
        : AI_JUDGE_CONTENT_VALIDATION_CODE.INVALID_NEW_BLOCKING_ERROR_REF,
      severity: AI_JUDGE_VALIDATION_SEVERITY.ERROR,
      target: {
        type: targetType,
        ref: invalidReference,
      },
      message: `${invalidReference} is not the next available ${referenceLabel} reference.`,
      correction: `Use ${expectedReferences.join(", ")} for the new ${referenceCollectionLabel} and preserve references belonging to existing items.`,
    },
  ];
};

const normalizeDuplicateReferences = <T extends { ref: string }>(
  items: T[],
  prefix: AiJudgeReferencePrefix,
  reservedReferences: string[] = [],
): T[] => {
  const usedReferences = new Set<string>();
  let nextReferenceNumber = [...items.map(({ ref }) => ref), ...reservedReferences].reduce(
    (highest, ref) => Math.max(highest, Number(ref.slice(1))),
    0,
  );

  return items.map((item) => {
    if (!usedReferences.has(item.ref)) {
      usedReferences.add(item.ref);
      return item;
    }

    let nextReference: string;
    do {
      nextReferenceNumber += 1;
      nextReference = `${prefix}${nextReferenceNumber}`;
    } while (usedReferences.has(nextReference));

    usedReferences.add(nextReference);
    return { ...item, ref: nextReference };
  });
};

const mapContentIssue = (
  configuration: ReferencedAiJudgeConfiguration,
  issue: AiJudgeContentValidationIssue,
): AiJudgeValidationIssue => {
  const criterion = configuration.criteria[issue.criterionIndex];
  if (!criterion) throw new Error(`Missing generated criterion at index ${issue.criterionIndex}`);

  switch (issue.code) {
    case AI_JUDGE_CONTENT_VALIDATION_CODE.GUIDANCE_SCORE_OUT_OF_RANGE:
      return {
        code: issue.code,
        severity: AI_JUDGE_VALIDATION_SEVERITY.ERROR,
        target: {
          type: AI_JUDGE_VALIDATION_TARGET.SCORE_GUIDANCE,
          ref: criterion.ref,
          score: issue.score,
        },
        message: `Score ${issue.score} is outside the criterion range 0 through ${issue.maxScore}.`,
        correction: `Use exactly one guidance item for each integer score from 0 through ${issue.maxScore}.`,
      };
    case AI_JUDGE_CONTENT_VALIDATION_CODE.DUPLICATE_GUIDANCE_SCORE:
      return {
        code: issue.code,
        severity: AI_JUDGE_VALIDATION_SEVERITY.ERROR,
        target: {
          type: AI_JUDGE_VALIDATION_TARGET.SCORE_GUIDANCE,
          ref: criterion.ref,
          score: issue.score,
        },
        message: `Score ${issue.score} has more than one guidance item.`,
        correction: `Keep exactly one guidance item for score ${issue.score}.`,
      };
    case AI_JUDGE_CONTENT_VALIDATION_CODE.MISSING_GUIDANCE_SCORES:
      return {
        code: issue.code,
        severity: AI_JUDGE_VALIDATION_SEVERITY.ERROR,
        target: {
          type: AI_JUDGE_VALIDATION_TARGET.CRITERION,
          ref: criterion.ref,
          field: "scoreGuidance",
        },
        message: `Scoring guidance is missing scores ${issue.missingScores.join(", ")}.`,
        correction: `Add one guidance item for each missing score: ${issue.missingScores.join(", ")}.`,
      };
  }
};
