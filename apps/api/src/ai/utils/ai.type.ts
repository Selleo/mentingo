export { AI_THREAD_STATUSES as THREAD_STATUS, MESSAGE_ROLE } from "@repo/shared";
export type { AiThreadStatus as ThreadStatus, MessageRole } from "@repo/shared";

export const OPENAI_MODELS = {
  BASIC: "gpt-5.4-mini",
  VOICE: "gpt-5.4-mini",
  EMBEDDING: "text-embedding-3-small",
  TRANSCRIBE: "whisper-1",
  TRANSLATION: "gpt-5.4-mini",
} as const;

export type OpenAIModels = (typeof OPENAI_MODELS)[keyof typeof OPENAI_MODELS];
