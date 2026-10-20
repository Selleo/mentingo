import { Injectable } from "@nestjs/common";

import { AiRuntimeService } from "src/ai/services/ai-runtime.service";
import { loadAiSdk } from "src/ai/utils/ai-esm";

import {
  SEMANTIC_SEARCH_EMBEDDING_DIMENSIONS,
  SEMANTIC_SEARCH_MODEL,
} from "./semantic-search-index.constants";

@Injectable()
export class SemanticSearchEmbeddingService {
  constructor(private readonly runtime: AiRuntimeService) {}

  async embedQuery(text: string): Promise<number[]> {
    const [embedding] = await this.embedTexts([text], 3000);
    return embedding;
  }

  async embedTexts(texts: string[], timeoutMs = 30_000): Promise<number[][]> {
    if (!texts.length) return [];
    const provider = await this.runtime.getAISdkOpenAI();
    const { embedMany } = await loadAiSdk();
    const { embeddings } = await embedMany({
      model: provider.embedding(SEMANTIC_SEARCH_MODEL),
      values: texts,
      telemetry: { isEnabled: false },
      maxRetries: 0,
      abortSignal: AbortSignal.timeout(timeoutMs),
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
    return embeddings;
  }
}
