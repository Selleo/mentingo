import { Inject, Injectable } from "@nestjs/common";
import { ENTITY_TYPES, type SupportedLanguages } from "@repo/shared";
import { and, eq, sql } from "drizzle-orm";

import { DatabasePg, type UUIDType } from "src/common";
import { setJsonbField, setJsonbStringArrayField } from "src/common/helpers/sqlHelpers";
import { RESOURCE_RELATIONSHIP_TYPES } from "src/file/file.constants";
import { LocalizationService } from "src/localization/localization.service";
import { DB } from "src/storage/db/db.providers";
import {
  categories,
  courses,
  coursesSummaryStats,
  resourceEntity,
  resources,
} from "src/storage/schema";

import { localizedLearningOutcomesSql } from "../utils/course-learning-outcomes-sql";

import type { UpdateCourseBody } from "../schemas/updateCourse.schema";
import type { CoursesSettings } from "../types/settings";
import type { PgInsertValue } from "drizzle-orm/pg-core";

@Injectable()
export class CourseEditingRepository {
  constructor(
    @Inject(DB) private readonly db: DatabasePg,
    private readonly localizationService: LocalizationService,
  ) {}

  async runInTransaction<T>(callback: (trx: DatabasePg) => Promise<T>) {
    return this.db.transaction(callback);
  }

  async findCourseById(courseId: UUIDType, db: DatabasePg = this.db) {
    const [course] = await db.select().from(courses).where(eq(courses.id, courseId));

    return course;
  }

  async findCourseAuthorId(courseId: UUIDType) {
    const [course] = await this.db
      .select({ authorId: courses.authorId })
      .from(courses)
      .where(eq(courses.id, courseId));

    return course?.authorId;
  }

  async categoryExists(categoryId: UUIDType, db: DatabasePg = this.db) {
    const [category] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.id, categoryId));

    return Boolean(category);
  }

  async findCourseActivitySnapshot(
    courseId: UUIDType,
    language: SupportedLanguages,
    db: DatabasePg = this.db,
  ) {
    const [course] = await db
      .select({
        id: courses.id,
        title: this.localizationService.getLocalizedSqlField(courses.title, language),
        description: this.localizationService.getLocalizedSqlField(courses.description, language),
        status: courses.status,
        isArchived: courses.isArchived,
        priceInCents: courses.priceInCents,
        currency: courses.currency,
        hasCertificate: courses.hasCertificate,
        courseType: courses.courseType,
        categoryId: courses.categoryId,
        authorId: courses.authorId,
        thumbnailS3Key: courses.thumbnailS3Key,
        thumbnailPositionY: courses.thumbnailPositionY,
        learningOutcomes: localizedLearningOutcomesSql(language),
        showAuthorSection: courses.showAuthorSection,
        settings: courses.settings,
        stripeProductId: courses.stripeProductId,
        stripePriceId: courses.stripePriceId,
      })
      .from(courses)
      .where(eq(courses.id, courseId));

    return course;
  }

  async insertCourse(values: PgInsertValue<typeof courses>, db: DatabasePg) {
    const [course] = await db.insert(courses).values(values).returning();

    return course;
  }

  async insertCourseSummaryStats(courseId: UUIDType, authorId: UUIDType, db: DatabasePg) {
    await db.insert(coursesSummaryStats).values({ courseId, authorId });
  }

  async updateCourseHasCertificate(courseId: UUIDType, hasCertificate: boolean) {
    const [course] = await this.db
      .update(courses)
      .set({ hasCertificate })
      .where(eq(courses.id, courseId))
      .returning();

    return course;
  }

  async updateCourseSettings(courseId: UUIDType, settings: CoursesSettings) {
    const [course] = await this.db
      .update(courses)
      .set({ settings })
      .where(eq(courses.id, courseId))
      .returning();

    return course;
  }

  async updateCourseMedia(
    courseId: UUIDType,
    media: { thumbnailPositionY?: number; thumbnailS3Key?: string },
  ) {
    const [course] = await this.db
      .update(courses)
      .set(media)
      .where(eq(courses.id, courseId))
      .returning();

    return course;
  }

  /** Writes localized fields in `language` only; price fields are written only when allowed. */
  async updateCourseDetails(
    courseId: UUIDType,
    updateCourseBody: UpdateCourseBody,
    { includePrice }: { includePrice: boolean },
    db: DatabasePg,
  ) {
    const { priceInCents, currency, title, description, learningOutcomes, language, ...rest } =
      updateCourseBody;

    const [course] = await db
      .update(courses)
      .set({
        ...rest,
        learningOutcomes: setJsonbStringArrayField(
          courses.learningOutcomes,
          language,
          learningOutcomes,
        ),
        title: setJsonbField(courses.title, language, title),
        description: setJsonbField(courses.description, language, description),
        ...(includePrice ? { priceInCents, currency } : {}),
      })
      .where(eq(courses.id, courseId))
      .returning();

    return course;
  }

  async updateCourseStripeIds(
    courseId: UUIDType,
    stripeIds: { stripeProductId?: string; stripePriceId: string },
    db: DatabasePg,
  ) {
    await db.update(courses).set(stripeIds).where(eq(courses.id, courseId));
  }

  async findActiveTrailerResourceIds(courseId: UUIDType) {
    const rows = await this.db
      .select({ id: resources.id })
      .from(resources)
      .innerJoin(resourceEntity, eq(resources.id, resourceEntity.resourceId))
      .where(
        and(
          eq(resourceEntity.entityId, courseId),
          eq(resourceEntity.entityType, ENTITY_TYPES.COURSE),
          eq(resourceEntity.relationshipType, RESOURCE_RELATIONSHIP_TYPES.TRAILER),
          eq(resources.archived, false),
        ),
      );

    return rows.map(({ id }) => id);
  }

  buildNewCourseSettings({
    lessonSequenceEnabled,
    quizFeedbackEnabled,
    videoCompletionTrackingEnabled,
    certificateFontColor,
  }: Pick<
    CoursesSettings,
    | "lessonSequenceEnabled"
    | "quizFeedbackEnabled"
    | "videoCompletionTrackingEnabled"
    | "certificateFontColor"
  >) {
    return sql`json_build_object(
      'repetitionEnabled', false,
      'lessonSequenceEnabled', ${lessonSequenceEnabled}::boolean,
      'quizFeedbackEnabled', ${quizFeedbackEnabled}::boolean,
      'videoCompletionTrackingEnabled', ${videoCompletionTrackingEnabled}::boolean,
      'certificateSignature', NULL,
      'certificateFontColor', ${certificateFontColor},
      'certificateValidity', NULL
    )`;
  }
}
