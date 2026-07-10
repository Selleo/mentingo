import { Injectable } from "@nestjs/common";

import { RagService } from "src/ai/services/rag.service";

import type { TextExtractionBody } from "src/ingestion/ingestion.schema";

@Injectable()
export class EmbeddingService {
  constructor(private readonly ragService: RagService) {}

  async embedPages(chunkedPages: TextExtractionBody): Promise<number[][]> {
    return this.ragService.getEmbeddings(chunkedPages.map((page) => page.pageContent));
  }
}
