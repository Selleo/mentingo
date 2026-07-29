import {
  AI_MENTOR_CONFIGURATION_GENERATION_MAX_ATTEMPTS,
  AI_MENTOR_CONFIGURATION_GENERATION_STATUS,
} from "@repo/shared";

import type {
  AiMentorGeneratedDraft,
  AiMentorGenerationSnapshot,
  AiMentorGenerationViewState,
  AiMentorQualityResult,
  AiMentorValidationResult,
} from "./aiMentorGeneration.types";
import type { AiMentorConfigurationDraft } from "../AiMentorConfiguration/aiMentorConfiguration.types";
import type { AiMentorType } from "@repo/shared";

/**
 * A generated result is never allowed to select or convert the Mentor mode.
 * The backend attaches the creator-selected type to the configuration after
 * validating model output.
 */
export const getApplicableAiMentorGeneratedConfiguration = (
  configuration: AiMentorGeneratedDraft | undefined,
  generationType: AiMentorType | undefined,
  currentType: AiMentorType,
): AiMentorConfigurationDraft | undefined => {
  if (
    !configuration ||
    !generationType ||
    generationType !== currentType ||
    configuration.type !== generationType
  )
    return;

  return configuration;
};

export const mapAiMentorValidationToQualityResult = (
  validation: AiMentorValidationResult,
): AiMentorQualityResult => ({
  passed: validation.passed,
  summary: validation.summary,
  findings: validation.issues.map((issue) => ({
    code: issue.code,
    field: issue.target.field,
    message: issue.message,
    correction: issue.correction,
  })),
});

const getGeneratedDraft = (
  progress: AiMentorGenerationSnapshot["progress"],
): AiMentorGeneratedDraft | undefined => {
  if ("configuration" in progress) return progress.configuration;
  if ("draft" in progress) return progress.draft;
};

export const mapAiMentorGenerationSnapshotToViewState = (
  snapshot: AiMentorGenerationSnapshot,
  generationType: AiMentorType,
): AiMentorGenerationViewState => {
  const { progress } = snapshot;
  const draft = getGeneratedDraft(progress);
  const quality =
    "validation" in progress
      ? mapAiMentorValidationToQualityResult(progress.validation)
      : undefined;
  const changes = "changes" in progress ? (progress.changes ?? []) : [];
  const error =
    progress.status === AI_MENTOR_CONFIGURATION_GENERATION_STATUS.FAILED
      ? progress.message
      : undefined;

  return {
    generationId: snapshot.generationId,
    status: progress.status,
    type: generationType,
    attempt: progress.attempt,
    maxAttempts: AI_MENTOR_CONFIGURATION_GENERATION_MAX_ATTEMPTS,
    draft,
    changes,
    quality,
    error,
  };
};
