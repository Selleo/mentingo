import { Inject, Injectable } from "@nestjs/common";
import { and, count, eq, inArray, lt, notExists, notInArray, sql } from "drizzle-orm";

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
import type { PreparedIngestionDocument } from "src/ingestion/ingestion-preparation.types";

@Injectable()
export class DocumentRepository {
  constructor(@Inject("DB") private readonly db: DatabasePg) {}

  async savePreparedDocument(input: PreparedIngestionDocument) {
    return this.db.transaction(async (transaction) => {
      await transaction.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${input.checksum}, 0))`,
      );
      const existing = await this.findDocument(
        [eq(documents.checksum, input.checksum)],
        transaction,
      );
      if (existing?.status === DOCUMENT_STATUS.READY) {
        if (input.metadata && Object.keys(input.metadata).length) {
          await transaction
            .update(documents)
            .set({
              metadata: sql`coalesce(${documents.metadata}, '{}'::jsonb) || ${JSON.stringify(input.metadata)}::jsonb`,
            })
            .where(eq(documents.id, existing.id));
        }
        return existing.id;
      }
      if (existing) {
        const [link] = await transaction
          .select({ id: documentToAiMentorLesson.id })
          .from(documentToAiMentorLesson)
          .where(eq(documentToAiMentorLesson.documentId, existing.id))
          .limit(1);
        if (link) throw new Error("ingestion.error.documentAlreadyAssigned");
        await transaction.delete(documents).where(eq(documents.id, existing.id));
      }
      const document = await this.insertDocument(
        input.filename,
        input.byteSize,
        input.contentType,
        input.checksum,
        transaction,
      );
      await transaction
        .update(documents)
        .set({ metadata: { courseAuthoringStaging: true, ...input.metadata } })
        .where(eq(documents.id, document.id));
      for (const [index, chunk] of input.chunks.entries())
        await transaction.insert(docChunks).values({
          documentId: document.id,
          chunkIndex: index,
          content: chunk.content,
          metadata: chunk.metadata,
          embedding: chunk.embedding,
        });
      await transaction
        .update(documents)
        .set({ status: DOCUMENT_STATUS.READY })
        .where(eq(documents.id, document.id));
      return document.id;
    });
  }

  async mergeDocumentMetadata(documentId: UUIDType, metadata: Record<string, unknown>) {
    await this.db
      .update(documents)
      .set({
        metadata: sql`coalesce(${documents.metadata}, '{}'::jsonb) || ${JSON.stringify(metadata)}::jsonb`,
      })
      .where(eq(documents.id, documentId));
  }

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

  /** Replaces only prior generated course-context links while preserving manual Mentor files. */
  async replaceCourseAuthoringMentorContext({
    documentIds,
    aiMentorLessonId,
    tenantId,
  }: {
    documentIds: UUIDType[];
    aiMentorLessonId: UUIDType;
    tenantId: UUIDType;
  }) {
    if (documentIds.length) {
      await this.db
        .insert(documentToAiMentorLesson)
        .values(documentIds.map((documentId) => ({ documentId, aiMentorLessonId })))
        .onConflictDoNothing();
    }

    const staleLinks = await this.db
      .select({ id: documentToAiMentorLesson.id })
      .from(documentToAiMentorLesson)
      .innerJoin(documents, eq(documents.id, documentToAiMentorLesson.documentId))
      .where(
        and(
          eq(documentToAiMentorLesson.aiMentorLessonId, aiMentorLessonId),
          eq(documentToAiMentorLesson.tenantId, tenantId),
          eq(documents.tenantId, tenantId),
          sql`${documents.metadata}->>'courseAuthoringMentorContext' = 'true'`,
          ...(documentIds.length
            ? [notInArray(documentToAiMentorLesson.documentId, documentIds)]
            : []),
        ),
      );

    if (staleLinks.length) {
      await this.db.delete(documentToAiMentorLesson).where(
        inArray(
          documentToAiMentorLesson.id,
          staleLinks.map((link) => link.id),
        ),
      );
    }
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

  /** Deletes aged authoring-only material that never acquired an AI Mentor lesson link. */
  async deleteExpiredUnassignedAuthoringDocuments(before: string) {
    await this.db
      .delete(documents)
      .where(
        and(
          lt(documents.createdAt, before),
          sql`${documents.metadata}->>'courseAuthoringStaging' = 'true'`,
          notExists(
            this.db
              .select({ id: documentToAiMentorLesson.id })
              .from(documentToAiMentorLesson)
              .where(eq(documentToAiMentorLesson.documentId, documents.id)),
          ),
        ),
      );
  }
}
