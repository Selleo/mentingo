import {
  AI_JUDGE_GENERATION_MODE,
  type AiJudgeGenerationMode,
} from "./ai-judge-configuration-generation.types";

import type { promptId } from "@repo/prompts";

export const AI_JUDGE_GENERATION_MODE_PROMPT_ID = {
  [AI_JUDGE_GENERATION_MODE.CREATE]: "aiJudgeConfigurationGeneratorCreate",
  [AI_JUDGE_GENERATION_MODE.IMPROVE]: "aiJudgeConfigurationGeneratorImprove",
  [AI_JUDGE_GENERATION_MODE.REPAIR]: "aiJudgeConfigurationGeneratorRepair",
} as const satisfies Record<AiJudgeGenerationMode, promptId>;

export const AI_JUDGE_GENERATION_FAILURE_MESSAGE = "AI Judge configuration generation failed";
export const AI_JUDGE_CONFIGURATION_GENERATOR_REASONING_EFFORT = "medium";
export const AI_JUDGE_CONFIGURATION_VALIDATOR_REASONING_EFFORT = "none";
export const AI_JUDGE_CONFIGURATION_VALIDATOR_MAX_ISSUES = 3;
export const AI_JUDGE_GENERATED_THRESHOLD_STEP = 10;
export const AI_JUDGE_CRITERION_REF_PATTERN = "^C[1-9][0-9]*$";
export const AI_JUDGE_BLOCKING_ERROR_REF_PATTERN = "^B[1-9][0-9]*$";
