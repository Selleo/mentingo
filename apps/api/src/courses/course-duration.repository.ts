import { Inject, Injectable } from "@nestjs/common";
import { and, count, eq, inArray, or, sql } from "drizzle-orm";

import { DatabasePg, type UUIDType } from "src/common";
import { LocalizationService } from "src/localization/localization.service";
import { ENTITY_TYPE } from "src/localization/localization.types";
import { DB } from "src/storage/db/db.providers";
import {
  chapters,
  courses,
  lessons,
  questions,
  resourceEntity,
  resources,
} from "src/storage/schema";

import type {
  DurationDb,
  DurationEstimatesByLanguage,
  DurationProjectionUpdate,
} from "./types/duration";

@Injectable()
export class CourseDurationRepository {
  constructor(
    @Inject(DB) private readonly db: DatabasePg,
    private readonly localizationService: LocalizationService,
  ) {}

  async withCourseDurationTransaction<T>(
    courseId: UUIDType,
    db: DurationDb | undefined,
    callback: (db: DatabasePg) => Promise<T>,
  ): Promise<T> {
    return (db ?? this.db).transaction(async (trx) => {
      await trx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${courseId}, 1917))`);
      return callback(trx);
    });
  }

  async getCourseLocalization(courseId: UUIDType, db: DurationDb = this.db) {
    return db
      .select({ baseLanguage: courses.baseLanguage, availableLocales: courses.availableLocales })
      .from(courses)
      .where(eq(courses.id, courseId))
      .limit(1);
  }

  async getCourseDurationRows(courseIds: UUIDType[], db: DurationDb = this.db) {
    return db
      .select({
        id: courses.id,
        baseLanguage: courses.baseLanguage,
        availableLocales: courses.availableLocales,
        durationEstimates: courses.durationEstimates,
      })
      .from(courses)
      .where(inArray(courses.id, courseIds));
  }

  async getChapterDurationRows(courseId: UUIDType, db: DurationDb = this.db) {
    return db
      .select({ id: chapters.id, durationEstimates: chapters.durationEstimates })
      .from(chapters)
      .where(eq(chapters.courseId, courseId));
  }

  async getChapterDurationRowsForCourses(courseIds: UUIDType[], db: DurationDb = this.db) {
    return db
      .select({ courseId: chapters.courseId, durationEstimates: chapters.durationEstimates })
      .from(chapters)
      .where(inArray(chapters.courseId, courseIds));
  }

  async getLessonDurationRows(courseId: UUIDType, db: DurationDb = this.db) {
    return db
      .select({
        id: lessons.id,
        chapterId: lessons.chapterId,
        durationEstimates: lessons.durationEstimates,
      })
      .from(lessons)
      .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
      .where(eq(chapters.courseId, courseId));
  }

  async getCourseIdByChapterId(chapterId: UUIDType, db: DurationDb = this.db) {
    return db
      .select({ courseId: chapters.courseId })
      .from(chapters)
      .where(eq(chapters.id, chapterId))
      .limit(1);
  }

  async getCourseIdByLessonId(lessonId: UUIDType, db: DurationDb = this.db) {
    return db
      .select({ courseId: chapters.courseId })
      .from(lessons)
      .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
      .where(eq(lessons.id, lessonId))
      .limit(1);
  }

  async getLessonProjectionRows(courseId: UUIDType, db: DurationDb = this.db) {
    return db
      .select({
        id: lessons.id,
        chapterId: lessons.chapterId,
        type: lessons.type,
        description: lessons.description,
        questionCount: sql<number>`COALESCE(${count(questions.id)}, 0)`,
      })
      .from(lessons)
      .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
      .leftJoin(questions, eq(questions.lessonId, lessons.id))
      .where(eq(chapters.courseId, courseId))
      .groupBy(lessons.id);
  }

  async getResourceRelations(resourceId: UUIDType, db: DurationDb = this.db) {
    return db
      .select({ entityId: resourceEntity.entityId, resourceEntityId: resourceEntity.id })
      .from(resourceEntity)
      .where(
        and(
          eq(resourceEntity.resourceId, resourceId),
          eq(resourceEntity.entityType, ENTITY_TYPE.LESSON),
        ),
      );
  }

  async getLessonsReferencingResourceContent(resourceId: UUIDType, db: DurationDb = this.db) {
    const pattern = `%${resourceId}%`;
    return db
      .select({ courseId: chapters.courseId, description: lessons.description })
      .from(lessons)
      .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
      .where(
        this.localizationService.getLocalizedFieldSearchCondition(lessons.description, pattern),
      );
  }

  async getLessonsByIds(lessonIds: UUIDType[], db: DurationDb = this.db) {
    return db
      .select({ courseId: chapters.courseId, description: lessons.description })
      .from(lessons)
      .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
      .where(inArray(lessons.id, lessonIds));
  }

  async getResourceRowsByReferences(resourceReferences: UUIDType[], db: DurationDb = this.db) {
    return db
      .select({
        id: resources.id,
        resourceEntityId: resourceEntity.id,
        contentType: resources.contentType,
        metadata: resources.metadata,
      })
      .from(resources)
      .leftJoin(
        resourceEntity,
        and(
          eq(resourceEntity.resourceId, resources.id),
          eq(resourceEntity.entityType, ENTITY_TYPE.LESSON),
        ),
      )
      .where(
        or(
          inArray(resources.id, resourceReferences),
          inArray(resourceEntity.id, resourceReferences),
        ),
      );
  }

  async updateLessonDurations(updates: DurationProjectionUpdate[], db: DurationDb) {
    return db.execute(sql`
        UPDATE ${lessons} AS target
        SET "duration_estimates" = source."duration_estimates",
            "updated_at" = target."updated_at"
        FROM (VALUES ${sql.join(
          updates.map(
            ({ id, durationEstimates }) => sql`(${id}::uuid, ${durationEstimates}::jsonb)`,
          ),
          sql`, `,
        )}) AS source ("id", "duration_estimates")
        WHERE target."id" = source."id"
      `);
  }

  async updateChapterDurations(updates: DurationProjectionUpdate[], db: DurationDb) {
    return db.execute(sql`
        UPDATE ${chapters} AS target
        SET "duration_estimates" = source."duration_estimates",
            "updated_at" = target."updated_at"
        FROM (VALUES ${sql.join(
          updates.map(
            ({ id, durationEstimates }) => sql`(${id}::uuid, ${durationEstimates}::jsonb)`,
          ),
          sql`, `,
        )}) AS source ("id", "duration_estimates")
        WHERE target."id" = source."id"
      `);
  }

  async updateCourseDuration(
    courseId: UUIDType,
    durationEstimates: DurationEstimatesByLanguage,
    db: DurationDb,
  ) {
    return db.execute(sql`
        UPDATE ${courses} AS target
        SET "duration_estimates" = source."duration_estimates",
            "updated_at" = target."updated_at"
        FROM (VALUES (${courseId}::uuid, ${durationEstimates}::jsonb))
          AS source ("id", "duration_estimates")
        WHERE target."id" = source."id"
      `);
  }
}
