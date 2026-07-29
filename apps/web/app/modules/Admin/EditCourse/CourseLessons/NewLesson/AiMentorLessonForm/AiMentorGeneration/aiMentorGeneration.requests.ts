import { AI_MENTOR_CONFIGURATION_GENERATION_MODE } from "@repo/shared";

import type {
  AiMentorGenerationRequest,
  AiMentorValidationResult,
} from "./aiMentorGeneration.types";
import type { AiMentorConfigurationDraft } from "../AiMentorConfiguration/aiMentorConfiguration.types";
import type {
  GenerateAiMentorConfigurationBody,
  ValidateAiMentorConfigurationDraftBody,
} from "~/api/generated-api";

type AiMentorGenerationContext = Pick<
  GenerateAiMentorConfigurationBody,
  "courseId" | "lessonId" | "lessonContext"
>;

export const buildAiMentorGenerationInput = (
  context: AiMentorGenerationContext,
  request: AiMentorGenerationRequest,
  latestValidation?: AiMentorValidationResult,
): GenerateAiMentorConfigurationBody => {
  if (request.mode === AI_MENTOR_CONFIGURATION_GENERATION_MODE.CREATE)
    return {
      ...context,
      mode: AI_MENTOR_CONFIGURATION_GENERATION_MODE.CREATE,
      configurationType: request.configurationType,
      brief: request.brief,
    };

  return {
    ...context,
    mode: AI_MENTOR_CONFIGURATION_GENERATION_MODE.IMPROVE,
    instruction: request.instruction,
    currentConfiguration: request.currentConfiguration,
    ...(latestValidation && { latestValidation }),
  };
};

export const buildAiMentorValidationInput = (
  context: AiMentorGenerationContext,
  configuration: AiMentorConfigurationDraft,
): ValidateAiMentorConfigurationDraftBody => ({
  ...context,
  configuration,
});
