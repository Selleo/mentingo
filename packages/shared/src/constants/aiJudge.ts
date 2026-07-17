export const AI_JUDGE_MAX_CRITERION_SCORE = 5;

export const AI_JUDGE_CONFIGURATION_GENERATION_SOCKET_EVENTS = {
  PROGRESS: "ai-judge-configuration-generation:progress",
} as const;

export type AiJudgeConfigurationGenerationSocketEvent =
  (typeof AI_JUDGE_CONFIGURATION_GENERATION_SOCKET_EVENTS)[keyof typeof AI_JUDGE_CONFIGURATION_GENERATION_SOCKET_EVENTS];
