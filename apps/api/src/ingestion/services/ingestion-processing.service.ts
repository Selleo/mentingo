import { Injectable, Logger } from "@nestjs/common";

import { DOCUMENT_STATUS } from "src/ingestion/ingestion.constants";
import { DocumentRepository } from "src/ingestion/repositories/document.repository";
import { IngestionRepository } from "src/ingestion/repositories/ingestion.repository";
import { ChunkService } from "src/ingestion/services/chunk.service";
import { DocumentService } from "src/ingestion/services/document.service";
import { EmbeddingService } from "src/ingestion/services/embedding.service";

import type { DocumentIngestionJobData } from "src/queue/queue.types";

@Injectable()
export class IngestionProcessingService {
  private readonly logger = new Logger(IngestionProcessingService.name);

  constructor(
    private readonly ingestionRepository: IngestionRepository,
    private readonly chunkService: ChunkService,
    private readonly documentRepository: DocumentRepository,
    private readonly documentService: DocumentService,
    private readonly embeddingService: EmbeddingService,
  ) {}

  async processDocumentIngestion(data: DocumentIngestionJobData) {
    const { tenantId, lessonId } = data;

    if (!tenantId) {
      throw new Error("Missing tenantId for ingestion job");
    }

    this.logger.log(
      `Processing ingestion started: tenantId=${tenantId}, lessonId=${lessonId}, fileName=${data.file.originalname}`,
    );

    const aiMentorLesson = await this.ingestionRepository.findAiMentorLessonFromLesson(lessonId);
    if (!aiMentorLesson) {
      this.logger.error(
        `AI mentor lesson lookup failed: tenantId=${tenantId}, lessonId=${lessonId}`,
      );
      throw new Error(`AI mentor lesson not found for lesson ${lessonId}`);
    }

    const newFile = {
      ...data.file,
      buffer: this.normalizeJobBuffer(data.file.buffer),
    };

    const { document, sha256 } = await this.documentService.verifyIfFileExists(newFile);
    if (document?.status === DOCUMENT_STATUS.FAILED) {
      this.logger.warn(
        `Existing failed document found, deleting: tenantId=${tenantId}, lessonId=${lessonId}, documentId=${document.id}`,
      );
      await this.documentService.deleteDocument(document.id);
    } else if (document) {
      this.logger.log(
        `Reusing existing document: tenantId=${tenantId}, lessonId=${lessonId}, documentId=${document.id}`,
      );
      await this.documentService.assignDocumentToAiMentorLesson(document.id, aiMentorLesson.id);
      this.logger.log(
        `Processing ingestion completed by reuse: tenantId=${tenantId}, lessonId=${lessonId}, documentId=${document.id}`,
      );
      return { ok: true };
    }

    const newDocument = await this.documentService.createDocument(newFile, sha256);
    this.logger.log(
      `Created new document: tenantId=${tenantId}, lessonId=${lessonId}, documentId=${newDocument.id}`,
    );
    await this.documentService.assignDocumentToAiMentorLesson(newDocument.id, aiMentorLesson.id);
    this.logger.log(
      `Assigned document to AI mentor lesson: tenantId=${tenantId}, lessonId=${lessonId}, documentId=${newDocument.id}, aiMentorLessonId=${aiMentorLesson.id}`,
    );

    try {
      const extractedPages = await this.chunkService.extractText(newFile);
      this.logger.log(
        `Extracted text pages: tenantId=${tenantId}, lessonId=${lessonId}, documentId=${newDocument.id}, pages=${extractedPages.length}`,
      );

      const { loc: _loc, ...rest } = extractedPages[0].metadata;
      await this.documentRepository.updateDocument(newDocument.id, {
        metadata: { ...rest },
      });

      const chunkedPages = await this.chunkService.chunkPages(extractedPages);
      const embeddings = await this.embeddingService.embedPages(chunkedPages);
      this.logger.log(
        `Chunked/embedded document: tenantId=${tenantId}, lessonId=${lessonId}, documentId=${newDocument.id}, chunks=${chunkedPages.length}`,
      );

      for (let i = 0; i < embeddings.length; i++) {
        await this.documentRepository.insertDocumentChunk({
          documentId: newDocument.id,
          chunkIndex: i,
          metadata: chunkedPages[i].metadata?.loc,
          content: chunkedPages[i].pageContent,
          embedding: embeddings[i],
        });
      }

      await this.documentService.updateDocumentStatus(newDocument.id, DOCUMENT_STATUS.READY);
      this.logger.log(
        `Processing ingestion completed: tenantId=${tenantId}, lessonId=${lessonId}, documentId=${newDocument.id}`,
      );

      return { ok: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "ingestion.error.jobFailed";
      this.logger.error(
        `Processing ingestion failed: tenantId=${tenantId}, lessonId=${lessonId}, documentId=${newDocument.id}, reason=${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );

      await this.documentService.updateDocumentStatus(
        newDocument.id,
        DOCUMENT_STATUS.FAILED,
        errorMessage,
      );

      throw error;
    }
  }

  private normalizeJobBuffer(
    buffer: Buffer | { data: number[] } | Uint8Array | ArrayBuffer,
  ): Buffer {
    if (Buffer.isBuffer(buffer)) return buffer;
    if (buffer instanceof Uint8Array) return Buffer.from(buffer);
    if (buffer instanceof ArrayBuffer) return Buffer.from(buffer);
    if (buffer && typeof buffer === "object" && "data" in buffer) {
      return Buffer.from(buffer.data);
    }

    throw new Error("Unsupported file buffer payload in ingestion job");
  }
}
