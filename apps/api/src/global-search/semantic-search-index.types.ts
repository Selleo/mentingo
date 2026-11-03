import type { SupportedLanguages } from "@repo/shared";

export interface SemanticSearchSourceKey {
  entityType: string;
  entityId: string;
  documentType: string;
  language: SupportedLanguages;
}

export interface SemanticSearchIndexJob extends SemanticSearchSourceKey {
  tenantId: string;
}

export interface SemanticSearchSource extends SemanticSearchSourceKey {
  content: string;
  sourceHash: string;
  sourceRevision: string;
  metadata: Record<string, unknown>;
  resourceReference: string | null;
  resourceContentType: string | null;
}

export interface SemanticSearchReconcileOptions {
  dryRun?: boolean;
  offset?: number;
  limit?: number;
}

/** The embedding space a stored or query vector belongs to; vectors only compare within one. */
export interface SemanticSearchEmbeddingIdentity {
  model: string;
  dimensions: number;
}

export interface SemanticSearchEmbeddings {
  embeddings: number[][];
  identity: SemanticSearchEmbeddingIdentity;
}

export interface SemanticSearchQueryEmbedding {
  embedding: number[];
  identity: SemanticSearchEmbeddingIdentity;
}
