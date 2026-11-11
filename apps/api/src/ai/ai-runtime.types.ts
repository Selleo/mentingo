export const AI_RUNTIME_SOURCES = {
  CORE: "core",
  LUMA: "luma",
} as const;

export type AiRuntimeSource = (typeof AI_RUNTIME_SOURCES)[keyof typeof AI_RUNTIME_SOURCES];

export type SemanticEmbeddingRequest = {
  values: string[];
  dimensions: number;
  /** OpenAI model used when Luma is not configured for embeddings or fails. */
  coreModel: string;
  timeoutMs: number;
};

export type SemanticEmbeddingResult = {
  embeddings: number[][];
  /** The model that actually produced the vectors. */
  model: string;
};
