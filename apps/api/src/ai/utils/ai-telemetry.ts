export const AI_TELEMETRY_FUNCTION_IDS = {
  COURSE_TRANSLATION: "course-translation",
  AI_MENTOR_CHAT: "ai-mentor-chat",
  AI_MENTOR_WELCOME: "ai-mentor-welcome",
  AI_MENTOR_RAG_EMBEDDINGS: "ai-mentor-rag-embeddings",
  AI_MENTOR_CONFIGURATION_GENERATION: "ai-mentor-configuration-generation",
  AI_MENTOR_CONFIGURATION_VALIDATION: "ai-mentor-configuration-validation",
  AI_JUDGE: "ai-judge",
  AI_JUDGE_CONFIGURATION_GENERATION: "ai-judge-configuration-generation",
  AI_JUDGE_CONFIGURATION_VALIDATION: "ai-judge-configuration-validation",
  AI_SUMMARY: "ai-summary",
} as const;

export type AiTelemetryFunctionId =
  (typeof AI_TELEMETRY_FUNCTION_IDS)[keyof typeof AI_TELEMETRY_FUNCTION_IDS];

export const buildAiTelemetry = (functionId: AiTelemetryFunctionId) => ({
  isEnabled: true,
  functionId,
  recordInputs: true,
  recordOutputs: true,
});
