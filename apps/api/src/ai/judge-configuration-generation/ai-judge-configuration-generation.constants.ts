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
