import { Module } from "@nestjs/common";

import { AiRuntimeService } from "src/ai/services/ai-runtime.service";
import { ChunkService } from "src/ingestion/services/chunk.service";
import { S3Module } from "src/s3/s3.module";

import { SearchIndexRepository } from "./search-index.repository";
import { SearchIndexService } from "./search-index.service";
import { SemanticSearchIndexCron } from "./semantic-search-index.cron";
import { SemanticSearchEmbeddingService } from "./semantic-search-index.embedding.service";
import { SemanticSearchIndexQueueService } from "./semantic-search-index.queue.service";
import { SemanticSearchIndexRepository } from "./semantic-search-index.repository";
import { SemanticSearchIndexService } from "./semantic-search-index.service";
import { SemanticSearchIndexWorker } from "./semantic-search-index.worker";

@Module({
  imports: [S3Module],
  providers: [
    SearchIndexService,
    SearchIndexRepository,
    AiRuntimeService,
    ChunkService,
    SemanticSearchEmbeddingService,
    SemanticSearchIndexRepository,
    SemanticSearchIndexService,
    SemanticSearchIndexQueueService,
    SemanticSearchIndexWorker,
    SemanticSearchIndexCron,
  ],
  exports: [SearchIndexService, SemanticSearchEmbeddingService, SemanticSearchIndexService],
})
export class SearchIndexModule {}
