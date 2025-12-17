import { Module } from "@nestjs/common";

import { AiModule } from "src/ai/ai.module";
import { RagRepository } from "src/ai/repositories/rag.repository";
import { RagService } from "src/ai/services/rag.service";
import { DocumentRepository } from "src/ingestion/repositories/document.repository";
import { IngestionRepository } from "src/ingestion/repositories/ingestion.repository";
import { ChunkService } from "src/ingestion/services/chunk.service";
import { DocumentService } from "src/ingestion/services/document.service";
import { EmbeddingService } from "src/ingestion/services/embedding.service";
import { IngestionService } from "src/ingestion/services/ingestion.service";
import { IngestionQueueService } from "src/ingestion/services/queue.service";
import { IngestionWorker } from "src/ingestion/workers/ingestion.worker";

import { IngestionController } from "./ingestion.controller";

@Module({
  imports: [AiModule],
  controllers: [IngestionController],
  providers: [
    RagRepository,
    IngestionService,
    IngestionRepository,
    DocumentService,
    DocumentRepository,
    IngestionQueueService,
    IngestionWorker,
    ChunkService,
    EmbeddingService,
    RagService,
  ],
  exports: [DocumentService],
})
export class IngestionModule {}
