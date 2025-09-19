import { Injectable, type OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Worker } from "bullmq";

import { buildRedisConnection } from "src/common/configuration/redis";
import { DOCUMENT_STATUS } from "src/ingestion/ingestion.constants";
import { DocumentRepository } from "src/ingestion/repositories/document.repository";
import { ChunkService } from "src/ingestion/services/chunk.service";
import { DocumentService } from "src/ingestion/services/document.service";
import { EmbeddingService } from "src/ingestion/services/embedding.service";

import type { Job } from "bullmq";
import type { RedisConfigSchema } from "src/common/configuration/redis";

@Injectable()
export class IngestionWorker implements OnModuleDestroy {
  private worker: Worker;

  constructor(
    private readonly configService: ConfigService,
    private readonly chunkService: ChunkService,
    private readonly documentRepository: DocumentRepository,
    private readonly documentService: DocumentService,
    private readonly embeddingService: EmbeddingService,
  ) {
    const redisCfg = this.configService.get("redis") as RedisConfigSchema;
    const connection = redisCfg && buildRedisConnection(redisCfg);

    this.worker = new Worker(
      "document-ingestion",
      async (job: Job) => {
        try {
          const newFile = {
            ...job.data.file,
            buffer: Buffer.from(job.data.file.buffer.data),
          };

          const extractedPages = await this.chunkService.extractText(newFile);

          const { loc: _loc, ...rest } = extractedPages[0].metadata;
          await this.documentRepository.updateDocument(job.data.documentId, {
            metadata: { ...rest },
          });

          const chunkedPages = await this.chunkService.chunkPages(extractedPages);

          const embeddings = await this.embeddingService.embedPages(chunkedPages);

          for (let i = 0; i < embeddings.length; i++) {
            await this.documentRepository.insertDocumentChunk({
              documentId: job.data.documentId,
              chunkIndex: i,
              metadata: chunkedPages[i].metadata?.loc,
              content: chunkedPages[i].pageContent,
              embedding: embeddings[i],
            });
          }

          await this.documentService.updateDocumentStatus(
            job.data.documentId,
            DOCUMENT_STATUS.READY,
          );

          return { ok: true };
        } catch (e) {
          await this.documentService.updateDocumentStatus(
            job.data.documentId,
            DOCUMENT_STATUS.FAILED,
            e,
          );
          return { ok: false };
        }
      },
      { connection, concurrency: Number(process.env.WORKER_CONCURRENCY || 10) },
    );
  }

  async onModuleDestroy() {
    await this.worker?.close();
  }
}
