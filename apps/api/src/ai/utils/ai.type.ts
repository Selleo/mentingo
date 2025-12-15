export const OPENAI_MODELS = {
  BASIC: "gpt-4.1-mini",
  EMBEDDING: "text-embedding-3-small",
} as const;

export type OpenAIModels = (typeof OPENAI_MODELS)[keyof typeof OPENAI_MODELS];

export const THREAD_STATUS = {
  ACTIVE: "active",
  COMPLETED: "completed",
  ARCHIVED: "archived",
} as const;

export type ThreadStatus = (typeof THREAD_STATUS)[keyof typeof THREAD_STATUS];

export const MESSAGE_ROLE = {
  SYSTEM: "system",
  USER: "user",
  MENTOR: "assistant",
  TOOL: "tool",
  SUMMARY: "summary",
} as const;

export type MessageRole = (typeof MESSAGE_ROLE)[keyof typeof MESSAGE_ROLE];
