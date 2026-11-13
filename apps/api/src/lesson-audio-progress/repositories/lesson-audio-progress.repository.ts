import { Inject, Injectable } from "@nestjs/common";
import { ENTITY_TYPES } from "@repo/shared";
import { and, eq, inArray, sql } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { activeLearningState } from "src/course-repetition/course-learning-state.sql";
import { activeLearningStateId } from "src/course-repetition/course-repetition.service";
import { RESOURCE_RELATIONSHIP_TYPES } from "src/file/file.constants";
import {
  formatInt4MultirangeLiteral,
  parseInt4Multirange,
} from "src/lesson-video-progress/utils/video-coverage-ranges";
import { DB } from "src/storage/db/db.providers";
import {
  chapters,
  courses,
  lessonAudioProgress,
  lessons,
  resourceEntity,
  resources,
  studentLessonProgress,
} from "src/storage/schema";

import type {
  EnsureLessonAudioProgressRowParams,
  GetAudioProgressForResourceIdsParams,
  LessonAudioContext,
  LessonAudioIdentity,
  LessonAudioProgressRow,
  MergeLessonAudioListenedRangesParams,
  NormalizeLessonAudioProgressRowParams,
} from "../lesson-audio-progress.types";

@Injectable()
export class LessonAudioProgressRepository {
  constructor(@Inject(DB) private readonly db: DatabasePg) {}

  async getLessonAudioContext(
    params: LessonAudioIdentity,
    dbInstance: DatabasePg = this.db,
  ): Promise<LessonAudioContext | null> {
    const [context] = await dbInstance
      .select({
        lessonId: lessons.id,
        lessonType: lessons.type,
        lessonCompleted: sql<boolean>`CASE WHEN ${studentLessonProgress.completedAt} IS NOT NULL THEN TRUE ELSE FALSE END`,
        videoCompletionTrackingEnabled: sql<boolean>`COALESCE((${courses.settings}->>'videoCompletionTrackingEnabled')::boolean, TRUE)`,
        audioCompletionTrackingEnabled: sql<boolean>`COALESCE((${courses.settings}->>'audioCompletionTrackingEnabled')::boolean, FALSE)`,
        resourceEntityId: resourceEntity.id,
        resourceContentType: resources.contentType,
        resourceMetadata: resources.metadata,
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
          activeLearningState(studentLessonProgress.learningStateId),
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
    params: EnsureLessonAudioProgressRowParams,
    dbInstance: DatabasePg = this.db,
  ) {
    const [row] = await dbInstance
      .insert(lessonAudioProgress)
      .values({
        learningStateId: await activeLearningStateId(dbInstance, params.studentId, params.lessonId),
        studentId: params.studentId,
        lessonId: params.lessonId,
        resourceEntityId: params.resourceEntityId,
        durationSeconds: params.durationSeconds,
        bucketSizeSeconds: params.bucketSizeSeconds,
      })
      .onConflictDoUpdate({
        target: [
          lessonAudioProgress.studentId,
          lessonAudioProgress.lessonId,
          lessonAudioProgress.resourceEntityId,
          lessonAudioProgress.learningStateId,
        ],
        set: {
          durationSeconds: sql`GREATEST(${lessonAudioProgress.durationSeconds}, EXCLUDED.duration_seconds)`,
          updatedAt: sql`now()`,
        },
      })
      .returning();

    return this.mapProgressRow(row);
  }

  async normalizeProgressRow(
    params: NormalizeLessonAudioProgressRowParams,
    dbInstance: DatabasePg = this.db,
  ) {
    const boundedRanges = sql`${lessonAudioProgress.listenedRanges} * int4multirange(int4range(0, ${params.maxBucketCount}, '[)'))`;
    const coveredBucketCount = sql`COALESCE((SELECT SUM(UPPER(range_item) - LOWER(range_item))::int FROM unnest(${boundedRanges}) AS range_item), 0)`;

    const [row] = await dbInstance
      .update(lessonAudioProgress)
      .set({
        durationSeconds: params.durationSeconds,
        listenedRanges: boundedRanges,
        coveredBucketCount,
        coveragePercent: sql`LEAST(1, (${coveredBucketCount})::numeric / ${params.maxBucketCount})`,
        updatedAt: sql`now()`,
      })
      .where(this.whereActiveProgressRow(params))
      .returning();

    return this.mapProgressRow(row);
  }

  async mergeListenedRanges(
    params: MergeLessonAudioListenedRangesParams,
    dbInstance: DatabasePg = this.db,
  ) {
    const multirangeLiteral = formatInt4MultirangeLiteral(params.ranges);
    const incomingMultirange = sql.raw(`'${multirangeLiteral}'::int4multirange`);
    const mergedRanges = sql`${lessonAudioProgress.listenedRanges} + ${incomingMultirange}`;
    const maxBucketCount = sql`GREATEST(1, CEIL(GREATEST(${lessonAudioProgress.durationSeconds}, ${params.durationSeconds})::numeric / ${params.bucketSizeSeconds})::int)`;
    const coveredBucketCount = sql`COALESCE((SELECT SUM(UPPER(range_item) - LOWER(range_item))::int FROM unnest(${mergedRanges}) AS range_item), 0)`;

    const [row] = await dbInstance
      .update(lessonAudioProgress)
      .set({
        durationSeconds: sql`GREATEST(${lessonAudioProgress.durationSeconds}, ${params.durationSeconds})`,
        bucketSizeSeconds: params.bucketSizeSeconds,
        listenedRanges: mergedRanges,
        coveredBucketCount,
        coveragePercent: sql`LEAST(1, (${coveredBucketCount})::numeric / ${maxBucketCount})`,
        activeListenSeconds: sql`${lessonAudioProgress.activeListenSeconds} + ${params.activeListenSecondsDelta}`,
        updatedAt: sql`now()`,
      })
      .where(this.whereActiveProgressRow(params))
      .returning();

    return this.mapProgressRow(row);
  }

  async markListened(params: LessonAudioIdentity, dbInstance: DatabasePg = this.db) {
    const [row] = await dbInstance
      .update(lessonAudioProgress)
      .set({
        isListened: true,
        listenedAt: sql`COALESCE(${lessonAudioProgress.listenedAt}, CURRENT_TIMESTAMP)`,
        updatedAt: sql`now()`,
      })
      .where(this.whereActiveProgressRow(params))
      .returning();

    return this.mapProgressRow(row);
  }

  async getProgressForResourceIds(
    params: GetAudioProgressForResourceIdsParams,
    dbInstance: DatabasePg = this.db,
  ) {
    if (!params.resourceEntityIds.length) return [];

    const rows = await dbInstance
      .select()
      .from(lessonAudioProgress)
      .where(
        and(
          eq(lessonAudioProgress.lessonId, params.lessonId),
          eq(lessonAudioProgress.studentId, params.studentId),
          activeLearningState(lessonAudioProgress.learningStateId),
          inArray(lessonAudioProgress.resourceEntityId, params.resourceEntityIds),
        ),
      );

    return rows.map((row) => this.mapProgressRow(row));
  }

  private whereActiveProgressRow(params: LessonAudioIdentity) {
    return and(
      eq(lessonAudioProgress.studentId, params.studentId),
      activeLearningState(lessonAudioProgress.learningStateId),
      eq(lessonAudioProgress.lessonId, params.lessonId),
      eq(lessonAudioProgress.resourceEntityId, params.resourceEntityId),
    );
  }

  private mapProgressRow(row: typeof lessonAudioProgress.$inferSelect): LessonAudioProgressRow {
    return {
      ...row,
      listenedRanges: parseInt4Multirange(row.listenedRanges),
      coveragePercent: Number(row.coveragePercent),
    };
  }
}
