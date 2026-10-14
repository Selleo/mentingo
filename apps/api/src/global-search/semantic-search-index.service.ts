import { Injectable } from "@nestjs/common";

import { ALLOWED_FILE_TYPES, MAX_MB_PER_FILE } from "src/ingestion/ingestion.config";
import { ChunkService } from "src/ingestion/services/chunk.service";
import { S3Service } from "src/s3/s3.service";

import { chunkSearchText, normalizeSearchText } from "./semantic-search-index.chunking";
import { SemanticSearchEmbeddingService } from "./semantic-search-index.embedding.service";
import { SemanticSearchIndexRepository } from "./semantic-search-index.repository";

import type { SemanticSearchIndexJob } from "./semantic-search-index.types";

@Injectable()
export class SemanticSearchIndexService {
  constructor(
    private readonly repository: SemanticSearchIndexRepository,
    private readonly embeddings: SemanticSearchEmbeddingService,
    private readonly s3: S3Service,
    private readonly extraction: ChunkService,
  ) {}

  async process(data: SemanticSearchIndexJob) {
    const source = await this.repository.findSource(data);
    if (!source) {
      await this.repository.deleteSource(data);
      return;
    }
    let text = normalizeSearchText(source.content);
    if (
      source.resourceReference &&
      source.resourceContentType &&
      ALLOWED_FILE_TYPES.includes(source.resourceContentType)
    ) {
      const size = await this.s3.getFileSize(source.resourceReference);
      if (size > MAX_MB_PER_FILE * 1024 * 1024)
        throw new Error("Search attachment exceeds the extraction size limit");
      const buffer = await this.s3.getFileBuffer(source.resourceReference);
      if (buffer.length > MAX_MB_PER_FILE * 1024 * 1024)
        throw new Error("Search attachment exceeds the extraction size limit");
      const pages = await this.extraction.extractText({
        buffer,
        mimetype: source.resourceContentType,
      } as Express.Multer.File);
      text = [source.content, ...pages.map((page) => page.pageContent)].join("\n\n");
    }
    const chunks = chunkSearchText(text);
    if (!chunks.length) return;
    const vectors: number[][] = [];
    for (let offset = 0; offset < chunks.length; offset += 32) {
      vectors.push(...(await this.embeddings.embedTexts(chunks.slice(offset, offset + 32))));
    }
    await this.repository.replace(source, chunks, vectors);
  }
}
