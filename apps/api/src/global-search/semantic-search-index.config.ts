import { SEMANTIC_SEARCH_MODEL } from "./semantic-search-index.constants";

import type { SemanticSearchEmbeddingIdentity } from "./semantic-search-index.types";

/** Restart the API after changing this process-wide background indexing switch. */
export const isSemanticSearchBackgroundIndexingEnabled = () =>
  process.env.SEMANTIC_SEARCH_BACKGROUND_INDEXING_ENABLED?.trim().toLowerCase() !== "false";

/**
 * The model the index should converge on, normally the Luma embeddings profile model. Chunks from
 * any other model are re-embedded; when unset, chunks from any model stay current.
 */
export const getPreferredSemanticSearchEmbeddingModel = (): string | undefined =>
  process.env.SEMANTIC_SEARCH_EMBEDDING_MODEL?.trim() || undefined;

export const getDefaultSemanticSearchEmbeddingIdentity = (): SemanticSearchEmbeddingIdentity => ({
  model: getPreferredSemanticSearchEmbeddingModel() ?? SEMANTIC_SEARCH_MODEL,
});
