import type {
  GetAiMentorConfigurationResponse,
  ReplaceAiMentorConfigurationBody,
  UpdateAiMentorConfigurationTranslationsBody,
} from "~/api/generated-api";

export type AiMentorConfigurationDraft = ReplaceAiMentorConfigurationBody;
export type AiMentorConfigurationResponse = GetAiMentorConfigurationResponse["data"];
export type AiMentorConfigurationTranslationInput = UpdateAiMentorConfigurationTranslationsBody;
