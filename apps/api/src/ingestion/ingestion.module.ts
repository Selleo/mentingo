import { Module } from "@nestjs/common";

import { DocumentRepository } from "src/ingestion/repositories/document.repository";
import { IngestionRepository } from "src/ingestion/repositories/ingestion.repository";
import { ChunkService } from "src/ingestion/services/chunk.service";
import { DocumentService } from "src/ingestion/services/document.service";
import { EmbeddingService } from "src/ingestion/services/embedding.service";
import { IngestionService } from "src/ingestion/services/ingestion.service";
import { QueueService } from "src/ingestion/services/queue.service";
import { IngestionWorker } from "src/ingestion/workers/ingestion.worker";

import { IngestionController } from "./ingestion.controller";

@Module({
  controllers: [IngestionController],
  providers: [
    IngestionService,
    IngestionRepository,
    DocumentService,
    DocumentRepository,
    QueueService,
    IngestionWorker,
    ChunkService,
    EmbeddingService,
  ],
  exports: [DocumentService],
})
export class IngestionModule {}
