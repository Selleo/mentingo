import { Inject, Injectable } from "@nestjs/common";
import { COURSE_GENERATION_SYNC_STATUS } from "@repo/shared";
import { and, eq, inArray, sql } from "drizzle-orm";

import { DatabasePg, type UUIDType } from "src/common";
import { DB } from "src/storage/db/db.providers";
import { lumaCourseGenerationSyncs } from "src/storage/schema";

export type LumaCourseGenerationSyncRecord = typeof lumaCourseGenerationSyncs.$inferSelect;

@Injectable()
export class LumaCourseGenerationSyncRepository {
  constructor(@Inject(DB) private readonly db: DatabasePg) {}

  async ensureNotStarted(courseId: UUIDType, draftId?: UUIDType | null) {
    const [record] = await this.db
      .insert(lumaCourseGenerationSyncs)
      .values({
        courseId,
        draftId,
        status: COURSE_GENERATION_SYNC_STATUS.NOT_STARTED,
      })
      .onConflictDoUpdate({
        target: lumaCourseGenerationSyncs.courseId,
        set: {
          updatedAt: sql`${lumaCourseGenerationSyncs.updatedAt}`,
        },
      })
      .returning();

    return record ?? null;
  }

  async tryMarkProcessing(courseId: UUIDType, draftId?: UUIDType | null) {
    await this.ensureNotStarted(courseId, draftId);

    const [record] = await this.db
      .update(lumaCourseGenerationSyncs)
      .set({
        status: COURSE_GENERATION_SYNC_STATUS.PROCESSING,
        draftId,
        startedAt: sql`now()`,
        processedAt: null,
        failedAt: null,
        dismissedAt: null,
        lastError: null,
        attemptCount: sql`${lumaCourseGenerationSyncs.attemptCount} + 1`,
      })
      .where(
        and(
          eq(lumaCourseGenerationSyncs.courseId, courseId),
          inArray(lumaCourseGenerationSyncs.status, [
            COURSE_GENERATION_SYNC_STATUS.NOT_STARTED,
            COURSE_GENERATION_SYNC_STATUS.FAILED,
          ]),
        ),
      )
      .returning();

    return record ?? null;
  }

  async markProcessed(courseId: UUIDType, trx: DatabasePg = this.db) {
    const [record] = await trx
      .update(lumaCourseGenerationSyncs)
      .set({
        status: COURSE_GENERATION_SYNC_STATUS.PROCESSED,
        processedAt: sql`now()`,
        failedAt: null,
        dismissedAt: null,
        lastError: null,
      })
      .where(eq(lumaCourseGenerationSyncs.courseId, courseId))
      .returning();

    return record ?? null;
  }

  async markFailed(courseId: UUIDType, lastError: string) {
    const [record] = await this.db
      .update(lumaCourseGenerationSyncs)
      .set({
        status: COURSE_GENERATION_SYNC_STATUS.FAILED,
        failedAt: sql`now()`,
        processedAt: null,
        dismissedAt: null,
        lastError,
      })
      .where(eq(lumaCourseGenerationSyncs.courseId, courseId))
      .returning();

    return record ?? null;
  }

  async markDismissed(courseId: UUIDType) {
    const [record] = await this.db
      .update(lumaCourseGenerationSyncs)
      .set({
        status: COURSE_GENERATION_SYNC_STATUS.DISMISSED,
        dismissedAt: sql`now()`,
        lastError: null,
      })
      .where(eq(lumaCourseGenerationSyncs.courseId, courseId))
      .returning();

    return record ?? null;
  }
}
