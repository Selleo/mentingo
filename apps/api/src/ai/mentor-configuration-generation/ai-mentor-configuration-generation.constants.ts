import {
  AI_MENTOR_CONFIGURATION_GENERATION_MODE,
  type AiMentorConfigurationGenerationMode,
} from "@repo/shared";

import type { promptId } from "@repo/prompts";

export const AI_MENTOR_CONFIGURATION_GENERATION_MODE_PROMPT_ID = {
  [AI_MENTOR_CONFIGURATION_GENERATION_MODE.CREATE]:
    "aiMentorConfigurationGeneratorCreate",
  [AI_MENTOR_CONFIGURATION_GENERATION_MODE.IMPROVE]:
    "aiMentorConfigurationGeneratorImprove",
  [AI_MENTOR_CONFIGURATION_GENERATION_MODE.REPAIR]:
    "aiMentorConfigurationGeneratorRepair",
} as const satisfies Record<AiMentorConfigurationGenerationMode, promptId>;

export const AI_MENTOR_CONFIGURATION_GENERATION_FAILURE_MESSAGE =
  "AI Mentor configuration generation failed";
export const AI_MENTOR_CONFIGURATION_GENERATOR_REASONING_EFFORT = "medium";
export const AI_MENTOR_CONFIGURATION_VALIDATOR_REASONING_EFFORT = "none";
export const AI_MENTOR_CONFIGURATION_VALIDATOR_MAX_ISSUES = 3;
