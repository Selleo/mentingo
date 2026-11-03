import {
  SEMANTIC_SEARCH_EMBEDDING_DIMENSIONS,
  SEMANTIC_SEARCH_MODEL,
  SEMANTIC_SEARCH_SUPPORTED_EMBEDDING_DIMENSIONS,
} from "./semantic-search-index.constants";

import type { SemanticSearchEmbeddingIdentity } from "./semantic-search-index.types";

/** Restart the API after changing this process-wide background indexing switch. */
export const isSemanticSearchBackgroundIndexingEnabled = () =>
  process.env.SEMANTIC_SEARCH_BACKGROUND_INDEXING_ENABLED?.trim().toLowerCase() !== "false";

export const getSemanticSearchEmbeddingDimensions = (): number => {
  const configured = process.env.SEMANTIC_SEARCH_EMBEDDING_DIMENSIONS?.trim();
  const dimensions = configured ? Number(configured) : SEMANTIC_SEARCH_EMBEDDING_DIMENSIONS;
  if (
    !SEMANTIC_SEARCH_SUPPORTED_EMBEDDING_DIMENSIONS.some((supported) => supported === dimensions)
  ) {
    throw new Error(
      `SEMANTIC_SEARCH_EMBEDDING_DIMENSIONS must be one of: ${SEMANTIC_SEARCH_SUPPORTED_EMBEDDING_DIMENSIONS.join(
        ", ",
      )}`,
    );
  }
  return dimensions;
};

/**
 * The model the index should converge on, normally the Luma embeddings profile model. Chunks from
 * any other model are re-embedded; when unset, chunks from any model stay current.
 */
export const getPreferredSemanticSearchEmbeddingModel = (): string | undefined =>
  process.env.SEMANTIC_SEARCH_EMBEDDING_MODEL?.trim() || undefined;

export const getDefaultSemanticSearchEmbeddingIdentity = (): SemanticSearchEmbeddingIdentity => ({
  model: getPreferredSemanticSearchEmbeddingModel() ?? SEMANTIC_SEARCH_MODEL,
  dimensions: getSemanticSearchEmbeddingDimensions(),
});
