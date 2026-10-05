export { AI_THREAD_STATUSES as THREAD_STATUS, MESSAGE_ROLE } from "@repo/shared";
export type { AiThreadStatus as ThreadStatus, MessageRole } from "@repo/shared";

// Text models can be overridden to use an OpenAI-compatible gateway (e.g. OpenRouter expects
// "openai/gpt-5.4-mini"). The embedding model must keep the vector size of the stored embeddings.
export const OPENAI_MODELS = {
  BASIC: process.env.OPENAI_MODEL_BASIC?.trim() || "gpt-5.4-mini",
  VOICE: "gpt-5.4-mini",
  EMBEDDING: process.env.OPENAI_MODEL_EMBEDDING?.trim() || "text-embedding-3-small",
  TRANSCRIBE: "whisper-1",
  TRANSLATION: process.env.OPENAI_MODEL_TRANSLATION?.trim() || "gpt-5.4-mini",
} as const;

export type OpenAIModels = (typeof OPENAI_MODELS)[keyof typeof OPENAI_MODELS];
