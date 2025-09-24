import { openai } from "@ai-sdk/openai";
import { Injectable } from "@nestjs/common";
import { embedMany } from "ai";

import { OPENAI_MODELS } from "src/ai/utils/ai.type";

import type { TextExtractionBody } from "src/ingestion/ingestion.schema";

@Injectable()
export class EmbeddingService {
  constructor() {}

  async embedPages(chunkedPages: TextExtractionBody): Promise<number[][]> {
    {
      const { embeddings } = await embedMany({
        model: openai.textEmbeddingModel(OPENAI_MODELS.EMBEDDING),
        values: chunkedPages.map((page) => page.pageContent),
      });

      return embeddings;
    }
  }
}
