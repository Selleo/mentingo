import { Injectable } from "@nestjs/common";
import { embedMany } from "ai";

import { RagService } from "src/ai/services/rag.service";
import { OPENAI_MODELS } from "src/ai/utils/ai.type";

import type { TextExtractionBody } from "src/ingestion/ingestion.schema";

@Injectable()
export class EmbeddingService {
  constructor(private readonly ragService: RagService) {}

  async embedPages(chunkedPages: TextExtractionBody): Promise<number[][]> {
    {
      const provider = await this.ragService.getOpenAI();

      const { embeddings } = await embedMany({
        model: provider.textEmbeddingModel(OPENAI_MODELS.EMBEDDING),
        values: chunkedPages.map((page) => page.pageContent),
      });

      return embeddings;
    }
  }
}
