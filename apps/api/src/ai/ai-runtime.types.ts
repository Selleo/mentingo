export const AI_RUNTIME_SOURCES = {
  CORE: "core",
  LUMA: "luma",
} as const;

export type AiRuntimeSource = (typeof AI_RUNTIME_SOURCES)[keyof typeof AI_RUNTIME_SOURCES];
