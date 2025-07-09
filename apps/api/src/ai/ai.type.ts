export const OPENAI_MODELS = {
  BASIC: "gpt-4.1-mini",
} as const;

export type OpenAIModels = (typeof OPENAI_MODELS)[keyof typeof OPENAI_MODELS];

export const THREAD_STATUS = {
  ACTIVE: "active",
  COMPLETED: "completed",
  ABANDONED: "abandoned",
} as const;

export type ThreadStatus = (typeof THREAD_STATUS)[keyof typeof THREAD_STATUS];

export const MESSAGE_ROLE = {
  SYSTEM: "system",
  USER: "user",
  MENTOR: "assistant",
  TOOL: "tool",
  SUMMARY: "summary", // summary is not a role supported by OpenAI, but it's mapped to system later on
} as const;

export type MessageRole = (typeof MESSAGE_ROLE)[keyof typeof MESSAGE_ROLE];

export const SUPPORTED_LANGUAGES = {
  PL: "pl",
  EN: "en",
};

export type SupportedLanguages = (typeof SUPPORTED_LANGUAGES)[keyof typeof SUPPORTED_LANGUAGES];
