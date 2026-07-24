import type { AiJudgeValidationResult } from "./aiJudgeConfiguration.types";
import type { TFunction } from "i18next";

const DETERMINISTIC_VALIDATION_CODES = new Set([
  "guidance_score_out_of_range",
  "duplicate_guidance_score",
  "missing_guidance_scores",
  "duplicate_criterion_ref",
  "duplicate_blocking_error_ref",
  "invalid_new_criterion_ref",
  "invalid_new_blocking_error_ref",
]);

export const getLocalizedAiJudgeValidationIssueText = (
  issue: AiJudgeValidationResult["issues"][number],
  t: TFunction,
) => {
  if (!DETERMINISTIC_VALIDATION_CODES.has(issue.code))
    return { message: issue.message, correction: issue.correction };

  const translationKey = `adminCourseView.curriculum.lesson.aiJudge.generation.deterministicValidation.${issue.code}`;

  return {
    message: t(`${translationKey}.message`),
    correction: t(`${translationKey}.correction`),
  };
};

export const getLocalizedAiJudgeValidationSummary = (
  validation: AiJudgeValidationResult,
  t: TFunction,
) =>
  validation.issues.some(({ code }) => DETERMINISTIC_VALIDATION_CODES.has(code))
    ? t("adminCourseView.curriculum.lesson.aiJudge.generation.deterministicValidation.summary")
    : validation.summary;
