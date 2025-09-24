import { createHash } from "node:crypto";

import { Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";

import { DocumentRepository } from "src/ingestion/repositories/document.repository";
import { documents } from "src/storage/schema";

import type { DatabasePg, UUIDType } from "src/common";
import type { DocumentStatus } from "src/ingestion/ingestion.constants";

@Injectable()
export class DocumentService {
  constructor(private readonly documentRepository: DocumentRepository) {}

  async deleteDocumentLink(documentLinkId: UUIDType) {
    await this.documentRepository.deleteDocumentLink(documentLinkId);
  }

  async assignDocumentToAiMentorLesson(
    documentId: UUIDType,
    aiMentorLessonId: UUIDType,
    trx?: DatabasePg,
  ) {
    await this.documentRepository.assignDocumentToAiMentorLesson({
      documentId,
      aiMentorLessonId,
      trx,
    });
  }

  async createDocument(file: Express.Multer.File, sha256: string, trx?: DatabasePg) {
    const { mimetype, originalname, size } = file;

    return await this.documentRepository.insertDocument(originalname, size, mimetype, sha256, trx);
  }

  async verifyIfFileExists(file: Express.Multer.File, trx?: DatabasePg) {
    const sha256 = createHash("sha256").update(file.originalname).update(file.buffer).digest("hex");

    const document = await this.documentRepository.findDocument(
      [eq(documents.checksum, sha256)],
      trx,
    );

    return { sha256, document };
  }

  async updateDocumentStatus(documentId: UUIDType, status: DocumentStatus, errorMessage?: string) {
    await this.documentRepository.updateDocument(documentId, { status, errorMessage });
  }

  async findAllDocumentsForLesson(lessonId: UUIDType) {
    return this.documentRepository.findAllDocumentsForLesson(lessonId);
  }

  async findCourseAuthorByDocumentLinkId(documentLinkId: UUIDType) {
    return this.documentRepository.findCourseAuthorByDocumentLessonLink(documentLinkId);
  }

  async deleteDocumentIfLastLink(documentLinkId: UUIDType) {
    const { lastLink, documentId } = await this.documentRepository.findIfLastLink(documentLinkId);

    if (lastLink) {
      await this.documentRepository.deleteDocument(documentId);
    }

    return { lastLink, documentId };
  }

  async deleteDocument(documentId: UUIDType) {
    await this.documentRepository.deleteDocument(documentId);
  }

  async deleteAllDocumentsIfLast(lessonId: UUIDType, trx?: DatabasePg) {
    const documentIds = await this.documentRepository.findDocumentsWithLastLink(lessonId, trx);
    if (documentIds.length) {
      await this.documentRepository.deleteDocuments(documentIds.map((doc) => doc.documentId));
    }
  }
}
