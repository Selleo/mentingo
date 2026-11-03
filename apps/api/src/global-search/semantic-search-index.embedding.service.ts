import { Injectable } from "@nestjs/common";

import { AiRuntimeService } from "src/ai/services/ai-runtime.service";

import {
  SEMANTIC_SEARCH_EMBEDDING_DIMENSIONS,
  SEMANTIC_SEARCH_MODEL,
} from "./semantic-search-index.constants";

import type {
  SemanticSearchEmbeddings,
  SemanticSearchQueryEmbedding,
} from "./semantic-search-index.types";

@Injectable()
export class SemanticSearchEmbeddingService {
  constructor(private readonly runtime: AiRuntimeService) {}

  async embedQuery(text: string): Promise<SemanticSearchQueryEmbedding> {
    const { embeddings, identity } = await this.embedTexts([text], 3000);
    return { embedding: embeddings[0], identity };
  }

  /** Luma first with OpenAI fallback; the identity names the model that produced the vectors. */
  async embedTexts(texts: string[], timeoutMs = 30_000): Promise<SemanticSearchEmbeddings> {
    if (!texts.length) return { embeddings: [], identity: { model: SEMANTIC_SEARCH_MODEL } };
    const { embeddings, model } = await this.runtime.createSemanticSearchEmbeddings({
      values: texts,
      dimensions: SEMANTIC_SEARCH_EMBEDDING_DIMENSIONS,
      coreModel: SEMANTIC_SEARCH_MODEL,
      timeoutMs,
    });
    if (
      embeddings.length !== texts.length ||
      embeddings.some(
        (vector) =>
          vector.length !== SEMANTIC_SEARCH_EMBEDDING_DIMENSIONS ||
          vector.some((value) => !Number.isFinite(value)),
      )
    ) {
      throw new Error("Invalid semantic search embedding response");
    }
    return { embeddings, identity: { model } };
  }
}
