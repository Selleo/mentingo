import { Injectable, Inject } from "@nestjs/common";
import { ENTITY_TYPES } from "@repo/shared";
import { and, eq, inArray, sql } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { RESOURCE_RELATIONSHIP_TYPES } from "src/file/file.constants";
import { DB } from "src/storage/db/db.providers";
import {
  chapters,
  courses,
  lessonVideoProgress,
  lessons,
  resourceEntity,
  resources,
  studentLessonProgress,
} from "src/storage/schema";

import { formatInt4MultirangeLiteral, parseInt4Multirange } from "../utils/video-coverage-ranges";

import type {
  EnsureLessonVideoProgressRowParams,
  GetProgressForResourceIdsParams,
  GetRequiredVideoProgressForLessonParams,
  LessonVideoContext,
  LessonVideoIdentity,
  LessonVideoProgressRow,
  MergeLessonVideoProgressRangesParams,
} from "../lesson-video-progress.types";

@Injectable()
export class LessonVideoProgressRepository {
  constructor(@Inject(DB) private readonly db: DatabasePg) {}

  async getLessonVideoContext(
    params: LessonVideoIdentity,
    dbInstance: DatabasePg = this.db,
  ): Promise<LessonVideoContext | null> {
    const [context] = await dbInstance
      .select({
        lessonId: lessons.id,
        lessonType: lessons.type,
        chapterId: chapters.id,
        courseId: chapters.courseId,
        lessonCompleted: sql<boolean>`CASE WHEN ${studentLessonProgress.completedAt} IS NOT NULL THEN TRUE ELSE FALSE END`,
        videoCompletionTrackingEnabled: sql<boolean>`COALESCE((${courses.settings}->>'videoCompletionTrackingEnabled')::boolean, TRUE)`,
        resourceEntityId: resourceEntity.id,
        resourceContentType: resources.contentType,
      })
      .from(resourceEntity)
      .innerJoin(resources, eq(resources.id, resourceEntity.resourceId))
      .innerJoin(lessons, eq(lessons.id, resourceEntity.entityId))
      .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
      .innerJoin(courses, eq(courses.id, chapters.courseId))
      .leftJoin(
        studentLessonProgress,
        and(
          eq(studentLessonProgress.lessonId, lessons.id),
          eq(studentLessonProgress.studentId, params.studentId),
        ),
      )
      .where(
        and(
          eq(resourceEntity.id, params.resourceEntityId),
          eq(resourceEntity.entityId, params.lessonId),
          eq(resourceEntity.entityType, ENTITY_TYPES.LESSON),
          eq(resourceEntity.relationshipType, RESOURCE_RELATIONSHIP_TYPES.ATTACHMENT),
          eq(resources.archived, false),
        ),
      );

    return context ?? null;
  }

  async ensureProgressRow(
    params: EnsureLessonVideoProgressRowParams,
    dbInstance: DatabasePg = this.db,
  ) {
    const [row] = await dbInstance
      .insert(lessonVideoProgress)
      .values({
        studentId: params.studentId,
        lessonId: params.lessonId,
        resourceEntityId: params.resourceEntityId,
        durationSeconds: params.durationSeconds,
        bucketSizeSeconds: params.bucketSizeSeconds,
      })
      .onConflictDoUpdate({
        target: [
          lessonVideoProgress.studentId,
          lessonVideoProgress.lessonId,
          lessonVideoProgress.resourceEntityId,
        ],
        set: {
          durationSeconds: sql`GREATEST(${lessonVideoProgress.durationSeconds}, EXCLUDED.duration_seconds)`,
          updatedAt: sql`now()`,
        },
      })
      .returning();

    return this.mapProgressRow(row);
  }

  async mergeWatchedRanges(
    params: MergeLessonVideoProgressRangesParams,
    dbInstance: DatabasePg = this.db,
  ) {
    const multirangeLiteral = formatInt4MultirangeLiteral(params.ranges);
    const incomingMultirange = sql.raw(`'${multirangeLiteral}'::int4multirange`);
    const mergedRanges = sql`${lessonVideoProgress.watchedRanges} + ${incomingMultirange}`;
    const maxBucketCount = sql`GREATEST(1, CEIL(GREATEST(${lessonVideoProgress.durationSeconds}, ${params.durationSeconds})::numeric / ${params.bucketSizeSeconds})::int)`;
    const coveredBucketCount = sql`COALESCE((SELECT SUM(UPPER(range_item) - LOWER(range_item))::int FROM unnest(${mergedRanges}) AS range_item), 0)`;

    const [row] = await dbInstance
      .update(lessonVideoProgress)
      .set({
        durationSeconds: sql`GREATEST(${lessonVideoProgress.durationSeconds}, ${params.durationSeconds})`,
        bucketSizeSeconds: params.bucketSizeSeconds,
        watchedRanges: mergedRanges,
        coveredBucketCount,
        coveragePercent: sql`LEAST(1, (${coveredBucketCount})::numeric / ${maxBucketCount})`,
        activeWatchSeconds: sql`${lessonVideoProgress.activeWatchSeconds} + ${params.activeWatchSecondsDelta}`,
        updatedAt: sql`now()`,
      })
      .where(
        and(
          eq(lessonVideoProgress.studentId, params.studentId),
          eq(lessonVideoProgress.lessonId, params.lessonId),
          eq(lessonVideoProgress.resourceEntityId, params.resourceEntityId),
        ),
      )
      .returning();

    return this.mapProgressRow(row);
  }

  async markWatched(params: LessonVideoIdentity, dbInstance: DatabasePg = this.db) {
    const [row] = await dbInstance
      .update(lessonVideoProgress)
      .set({
        isWatched: true,
        watchedAt: sql`COALESCE(${lessonVideoProgress.watchedAt}, CURRENT_TIMESTAMP)`,
        updatedAt: sql`now()`,
      })
      .where(
        and(
          eq(lessonVideoProgress.studentId, params.studentId),
          eq(lessonVideoProgress.lessonId, params.lessonId),
          eq(lessonVideoProgress.resourceEntityId, params.resourceEntityId),
        ),
      )
      .returning();

    return this.mapProgressRow(row);
  }

  async getRequiredVideoProgressForLesson(
    params: GetRequiredVideoProgressForLessonParams,
    dbInstance: DatabasePg = this.db,
  ) {
    const rows = await dbInstance
      .select({
        resourceEntityId: resourceEntity.id,
        isWatched: sql<boolean>`COALESCE(${lessonVideoProgress.isWatched}, FALSE)`,
      })
      .from(resourceEntity)
      .innerJoin(resources, eq(resources.id, resourceEntity.resourceId))
      .leftJoin(
        lessonVideoProgress,
        and(
          eq(lessonVideoProgress.resourceEntityId, resourceEntity.id),
          eq(lessonVideoProgress.lessonId, params.lessonId),
          eq(lessonVideoProgress.studentId, params.studentId),
        ),
      )
      .where(
        and(
          eq(resourceEntity.entityId, params.lessonId),
          eq(resourceEntity.entityType, ENTITY_TYPES.LESSON),
          eq(resourceEntity.relationshipType, RESOURCE_RELATIONSHIP_TYPES.ATTACHMENT),
          eq(resources.archived, false),
          sql<boolean>`${resources.contentType} LIKE 'video/%'`,
        ),
      );

    return rows;
  }

  async getProgressForResourceIds(
    params: GetProgressForResourceIdsParams,
    dbInstance: DatabasePg = this.db,
  ) {
    if (!params.resourceEntityIds.length) return [];

    const rows = await dbInstance
      .select()
      .from(lessonVideoProgress)
      .where(
        and(
          eq(lessonVideoProgress.lessonId, params.lessonId),
          eq(lessonVideoProgress.studentId, params.studentId),
          inArray(lessonVideoProgress.resourceEntityId, params.resourceEntityIds),
        ),
      );

    return rows.map((row) => this.mapProgressRow(row));
  }

  private mapProgressRow(row: typeof lessonVideoProgress.$inferSelect): LessonVideoProgressRow {
    return {
      ...row,
      watchedRanges: parseInt4Multirange(row.watchedRanges),
      coveragePercent: Number(row.coveragePercent),
    };
  }
}
