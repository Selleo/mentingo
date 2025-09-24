import { Inject, Injectable } from "@nestjs/common";
import { and, count, eq, inArray, sql } from "drizzle-orm";

import { DatabasePg, type UUIDType } from "src/common";
import { DOCUMENT_STATUS } from "src/ingestion/ingestion.constants";
import {
  aiMentorLessons,
  chapters,
  courses,
  docChunks,
  documents,
  documentToAiMentorLesson,
  lessons,
} from "src/storage/schema";

import type { SQL } from "drizzle-orm";

@Injectable()
export class DocumentRepository {
  constructor(@Inject("DB") private readonly db: DatabasePg) {}

  async findDocument(conditions: SQL[], trx: DatabasePg = this.db) {
    const [document] = await trx
      .select()
      .from(documents)
      .where(and(...conditions));

    return document;
  }

  async assignDocumentToAiMentorLesson({
    documentId,
    aiMentorLessonId,
    trx = this.db,
  }: {
    documentId: UUIDType;
    aiMentorLessonId: UUIDType;
    trx?: DatabasePg;
  }) {
    const [documentToLesson] = await trx
      .insert(documentToAiMentorLesson)
      .values({ documentId, aiMentorLessonId })
      .onConflictDoNothing()
      .returning();

    return documentToLesson;
  }

  async deleteDocumentLink(documentLessonLinkId: UUIDType) {
    await this.db
      .delete(documentToAiMentorLesson)
      .where(eq(documentToAiMentorLesson.id, documentLessonLinkId));
  }

  async insertDocument(
    fileName: string,
    byteSize: number,
    contentType: string,
    checksum: string,
    trx: DatabasePg = this.db,
  ) {
    const [document] = await trx
      .insert(documents)
      .values({ fileName, byteSize, contentType, checksum })
      .returning();

    return document;
  }

  async updateDocument(documentId: UUIDType, data: Partial<typeof documents.$inferSelect>) {
    const [updatedDocument] = await this.db
      .update(documents)
      .set(data)
      .where(eq(documents.id, documentId))
      .returning();

    return updatedDocument;
  }

  async insertDocumentChunk(data: typeof docChunks.$inferInsert) {
    const [documentChunk] = await this.db.insert(docChunks).values(data).returning();
    return documentChunk;
  }

  async findAllDocumentsForLesson(lessonId: UUIDType) {
    return this.db
      .select({
        id: documentToAiMentorLesson.id,
        name: documents.fileName,
        type: documents.contentType,
        size: documents.byteSize,
      })
      .from(documents)
      .innerJoin(documentToAiMentorLesson, eq(documents.id, documentToAiMentorLesson.documentId))
      .innerJoin(aiMentorLessons, eq(documentToAiMentorLesson.aiMentorLessonId, aiMentorLessons.id))
      .where(
        and(eq(aiMentorLessons.lessonId, lessonId), eq(documents.status, DOCUMENT_STATUS.READY)),
      );
  }

  async findCourseAuthorByDocumentLessonLink(documentLinkId: UUIDType) {
    const [author] = await this.db
      .select({
        author: courses.authorId,
      })
      .from(courses)
      .innerJoin(chapters, eq(courses.id, chapters.courseId))
      .innerJoin(lessons, eq(chapters.id, lessons.chapterId))
      .innerJoin(aiMentorLessons, eq(lessons.id, aiMentorLessons.lessonId))
      .innerJoin(
        documentToAiMentorLesson,
        eq(aiMentorLessons.id, documentToAiMentorLesson.aiMentorLessonId),
      )
      .where(eq(documentToAiMentorLesson.id, documentLinkId));

    return author;
  }

  async findIfLastLink(documentLinkId: UUIDType) {
    const [lastLink] = await this.db
      .select({
        lastLink: sql<boolean>`count(*) = 1`,
        documentId: documentToAiMentorLesson.documentId,
      })
      .from(documentToAiMentorLesson)
      .where(
        eq(
          documentToAiMentorLesson.documentId,
          this.db
            .select({ documentId: documentToAiMentorLesson.documentId })
            .from(documentToAiMentorLesson)
            .where(eq(documentToAiMentorLesson.id, documentLinkId)),
        ),
      )
      .groupBy(documentToAiMentorLesson.documentId);

    return lastLink;
  }

  async findDocumentsWithLastLink(lessonId: UUIDType, trx: DatabasePg = this.db) {
    return trx
      .select({
        documentId: documents.id,
      })
      .from(documents)
      .innerJoin(documentToAiMentorLesson, eq(documentToAiMentorLesson.documentId, documents.id))
      .innerJoin(aiMentorLessons, eq(aiMentorLessons.id, documentToAiMentorLesson.aiMentorLessonId))
      .where(
        and(
          eq(aiMentorLessons.lessonId, lessonId),
          eq(
            this.db
              .select({ documentCount: count(documentToAiMentorLesson.documentId) })
              .from(documentToAiMentorLesson),
            1,
          ),
        ),
      )
      .groupBy(documents.id);
  }

  async deleteDocuments(documentIds: UUIDType[], trx: DatabasePg = this.db) {
    await trx.delete(documents).where(inArray(documents.id, documentIds));
  }

  async deleteDocument(documentId: UUIDType) {
    await this.db.delete(documents).where(eq(documents.id, documentId));
  }
}
