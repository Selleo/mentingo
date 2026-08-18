import {
  AI_MENTOR_CONFIGURATION_GENERATION_MODE,
  AI_MENTOR_CONFIGURATION_GENERATION_STATUS,
} from "@repo/shared";

import type { AiMentorConfigurationDraft } from "../AiMentorConfiguration/aiMentorConfiguration.types";
import type { AiMentorType } from "@repo/shared";
import type {
  GetAiMentorConfigurationGenerationResponse,
  ValidateAiMentorConfigurationDraftResponse,
} from "~/api/generated-api";

export const AI_MENTOR_GENERATION_MODE = {
  CREATE: AI_MENTOR_CONFIGURATION_GENERATION_MODE.CREATE,
  IMPROVE: AI_MENTOR_CONFIGURATION_GENERATION_MODE.IMPROVE,
} as const;

export type AiMentorGenerationMode =
  (typeof AI_MENTOR_GENERATION_MODE)[keyof typeof AI_MENTOR_GENERATION_MODE];

export const AI_MENTOR_GENERATION_STATUS =
  AI_MENTOR_CONFIGURATION_GENERATION_STATUS;

export type AiMentorGenerationStatus =
  (typeof AI_MENTOR_GENERATION_STATUS)[keyof typeof AI_MENTOR_GENERATION_STATUS];

export type AiMentorGenerationRequest =
  | {
      mode: typeof AI_MENTOR_GENERATION_MODE.CREATE;
      brief: string;
      configurationType: AiMentorType;
    }
  | {
      mode: typeof AI_MENTOR_GENERATION_MODE.IMPROVE;
      instruction: string;
      currentConfiguration: AiMentorConfigurationDraft;
    };

/**
 * The model omits `type`; the server attaches the trusted creator-selected
 * type before returning this public configuration draft.
 */
export type AiMentorGeneratedDraft = AiMentorConfigurationDraft;

export type AiMentorGenerationChange = {
  field: string;
  before?: string | null;
  after?: string | null;
};

export type AiMentorQualityFinding = {
  code: string;
  field?: string;
  message: string;
  correction: string;
};

export type AiMentorQualityResult = {
  passed: boolean;
  summary: string;
  findings: AiMentorQualityFinding[];
};

export type AiMentorGenerationViewState = {
  generationId: string;
  status: AiMentorGenerationStatus;
  type: AiMentorType;
  attempt: number;
  maxAttempts: number;
  draft?: AiMentorGeneratedDraft;
  changes: AiMentorGenerationChange[];
  quality?: AiMentorQualityResult;
  error?: string;
};

export type AiMentorGenerationSnapshot =
  GetAiMentorConfigurationGenerationResponse["data"];
export type AiMentorValidationResult = ValidateAiMentorConfigurationDraftResponse["data"];
