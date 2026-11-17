import { Inject, Injectable } from "@nestjs/common";
import { ENTITY_TYPES } from "@repo/shared";
import { and, eq, inArray, sql } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { activeLearningState } from "src/course-repetition/course-learning-state.sql";
import { RESOURCE_RELATIONSHIP_TYPES } from "src/file/file.constants";
import { LocalizationService } from "src/localization/localization.service";
import { DB } from "src/storage/db/db.providers";
import {
  chapters,
  courses,
  lessonAudioProgress,
  lessonVideoProgress,
  lessons,
  resourceEntity,
  resources,
} from "src/storage/schema";

import type { GetRequiredMediaProgressForLessonParams } from "../lesson-media-completion.types";
import type { SupportedLanguages } from "@repo/shared";

@Injectable()
export class LessonMediaCompletionRepository {
  constructor(
    @Inject(DB) private readonly db: DatabasePg,
    private readonly localizationService: LocalizationService,
  ) {}

  async getLocalizedLessonDescription(
    lessonId: string,
    language?: SupportedLanguages,
    dbInstance: DatabasePg = this.db,
  ) {
    const [row] = await dbInstance
      .select({
        description: this.localizationService.getLocalizedSqlField(lessons.description, language),
      })
      .from(lessons)
      .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
      .innerJoin(courses, eq(courses.id, chapters.courseId))
      .where(eq(lessons.id, lessonId));

    return row?.description ?? null;
  }

  async getRequiredVideoProgressForLesson(
    params: GetRequiredMediaProgressForLessonParams,
    dbInstance: DatabasePg = this.db,
  ) {
    return dbInstance
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
          and(
            eq(lessonVideoProgress.studentId, params.studentId),
            activeLearningState(lessonVideoProgress.learningStateId),
          ),
        ),
      )
      .where(
        and(
          eq(resourceEntity.entityId, params.lessonId),
          eq(resourceEntity.entityType, ENTITY_TYPES.LESSON),
          eq(resourceEntity.relationshipType, RESOURCE_RELATIONSHIP_TYPES.ATTACHMENT),
          eq(resources.archived, false),
          sql<boolean>`${resources.contentType} LIKE 'video/%'`,
          inArray(resourceEntity.id, params.resourceEntityIds),
        ),
      );
  }

  async getRequiredAudioProgressForLesson(
    params: GetRequiredMediaProgressForLessonParams,
    dbInstance: DatabasePg = this.db,
  ) {
    return dbInstance
      .select({
        resourceEntityId: resourceEntity.id,
        isListened: sql<boolean>`COALESCE(${lessonAudioProgress.isListened}, FALSE)`,
      })
      .from(resourceEntity)
      .innerJoin(resources, eq(resources.id, resourceEntity.resourceId))
      .leftJoin(
        lessonAudioProgress,
        and(
          eq(lessonAudioProgress.resourceEntityId, resourceEntity.id),
          eq(lessonAudioProgress.lessonId, params.lessonId),
          and(
            eq(lessonAudioProgress.studentId, params.studentId),
            activeLearningState(lessonAudioProgress.learningStateId),
          ),
        ),
      )
      .where(
        and(
          eq(resourceEntity.entityId, params.lessonId),
          eq(resourceEntity.entityType, ENTITY_TYPES.LESSON),
          eq(resourceEntity.relationshipType, RESOURCE_RELATIONSHIP_TYPES.ATTACHMENT),
          eq(resources.archived, false),
          sql<boolean>`${resources.contentType} LIKE 'audio/%'`,
          inArray(resourceEntity.id, params.resourceEntityIds),
        ),
      );
  }
}
