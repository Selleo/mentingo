import { Inject, Injectable } from "@nestjs/common";
import { and, eq, getTableColumns, gte, inArray, lte, sql } from "drizzle-orm";

import { DatabasePg, type UUIDType } from "src/common";
import { buildJsonbField, setJsonbField } from "src/common/helpers/sqlHelpers";
import { LocalizationService } from "src/localization/localization.service";
import { ENTITY_TYPE } from "src/localization/localization.types";
import {
  aiMentorLessons,
  chapters,
  courses,
  liveLessons,
  lessons,
  resourceEntity,
  resources,
} from "src/storage/schema";
import { settingsToJSONBuildObject } from "src/utils/settings-to-json-build-object";

import { LESSON_TYPES } from "../lesson.type";

import type {
  CreateAiMentorLessonBody,
  CreateLessonBody,
  UpdateLessonBody,
} from "../lesson.schema";
import type { CreateLiveLessonInput } from "../lesson.type";
import type { AiMentorTTSPreset, AiMentorVoiceMode, SupportedLanguages } from "@repo/shared";
@Injectable()
export class AdminLessonRepository {
  constructor(
    @Inject("DB") private readonly db: DatabasePg,
    private readonly localizationService: LocalizationService,
  ) {}

  async getLesson(id: UUIDType, language?: SupportedLanguages) {
    return this.db
      .select({
        ...getTableColumns(lessons),
        courseId: chapters.courseId,
        title: this.localizationService.getLocalizedSqlField(lessons.title, language),
        description: this.localizationService.getLocalizedSqlField(lessons.description, language),
        aiMentorName: this.localizationService.getLocalizedSqlField(aiMentorLessons.name, language),
        aiMentorAvatarReference: aiMentorLessons.avatarReference,
        aiMentorVoiceMode: aiMentorLessons.voiceMode,
        aiMentorTTSPreset: aiMentorLessons.ttsPreset,
        aiMentorCustomTtsReference: language
          ? this.localizationService.getFieldByLanguage(
              aiMentorLessons.customTtsReference,
              language,
            )
          : this.localizationService.getLocalizedSqlField(aiMentorLessons.customTtsReference),
      })
      .from(lessons)
      .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
      .innerJoin(courses, eq(courses.id, chapters.courseId))
      .leftJoin(aiMentorLessons, eq(aiMentorLessons.lessonId, lessons.id))
      .where(eq(lessons.id, id));
  }

  async getContentLessonsByIds(lessonIds: UUIDType[], language?: SupportedLanguages) {
    if (!lessonIds.length) return [];

    return this.db
      .select({
        ...getTableColumns(lessons),
        courseId: chapters.courseId,
        title: this.localizationService.getLocalizedSqlField(lessons.title, language),
        description: this.localizationService.getLocalizedSqlField(lessons.description, language),
      })
      .from(lessons)
      .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
      .innerJoin(courses, eq(courses.id, chapters.courseId))
      .where(and(inArray(lessons.id, lessonIds), eq(lessons.type, LESSON_TYPES.CONTENT)));
  }

  async createLessonForChapter(
    data: CreateLessonBody,
    language: SupportedLanguages,
    dbInstance: DatabasePg = this.db,
  ) {
    const [lesson] = await dbInstance
      .insert(lessons)
      .values({
        ...data,
        title: buildJsonbField(language, data.title),
        description: buildJsonbField(language, data.description),
      })
      .returning({
        ...getTableColumns(lessons),
        title: sql<string>`lessons.title->>${language}`,
        description: sql<string>`lessons.description->>${language}`,
      });
    return lesson;
  }

  async updateLesson(id: UUIDType, data: UpdateLessonBody, dbInstance: DatabasePg = this.db) {
    const [updatedLesson] = await dbInstance
      .update(lessons)
      .set({
        ...data,
        title: setJsonbField(lessons.title, data.language, data.title),
        description: setJsonbField(lessons.description, data.language, data.description),
      })
      .where(eq(lessons.id, id))
      .returning({
        ...getTableColumns(lessons),
        title: sql<string>`lessons.title->>${data.language}`,
        description: sql<string>`lessons.description->>${data.language}`,
      });

    return updatedLesson;
  }

  async createAiMentorLesson(
    data: CreateAiMentorLessonBody,
    displayOrder: number,
    language: SupportedLanguages,
    dbInstance: DatabasePg = this.db,
  ) {
    const descriptionValue =
      data.description === undefined ? null : buildJsonbField(language, data.description, true);

    const [lesson] = await dbInstance
      .insert(lessons)
      .values({
        title: buildJsonbField(language, data.title),
        description: descriptionValue,
        type: LESSON_TYPES.AI_MENTOR,
        chapterId: data?.chapterId,
        displayOrder,
        isExternal: true,
      })
      .returning({
        ...getTableColumns(lessons),
        title: sql<string>`lessons.title->>${language}::text`,
        description: sql<string>`lessons.description->>${language}::text`,
      });

    return lesson;
  }

  async updateAiMentorLesson(
    id: UUIDType,
    data: { title?: string; description?: string | null; language: SupportedLanguages },
    dbInstance: DatabasePg = this.db,
  ) {
    const description =
      data.description !== undefined
        ? setJsonbField(lessons.description, data.language, data.description, true, true)
        : undefined;

    return dbInstance
      .update(lessons)
      .set({
        title: data.title ? setJsonbField(lessons.title, data.language, data.title) : undefined,
        description,
      })
      .where(eq(lessons.id, id))
      .returning({
        ...getTableColumns(lessons),
        title: sql<string>`lessons.title->>${data.language}`,
        description: sql<string>`lessons.description->>${data.language}`,
      });
  }

  async updateAiMentorLessonData(
    lessonId: UUIDType,
    data: {
      name?: string;
      voiceMode: AiMentorVoiceMode;
      ttsPreset: AiMentorTTSPreset;
      customTtsReference?: string | null;
      language: SupportedLanguages;
    },
    dbInstance: DatabasePg = this.db,
  ) {
    const customTtsReference =
      data.customTtsReference === undefined
        ? undefined
        : setJsonbField(
            aiMentorLessons.customTtsReference,
            data.language,
            data.customTtsReference,
            true,
            true,
          );

    return dbInstance
      .update(aiMentorLessons)
      .set({
        name: setJsonbField(aiMentorLessons.name, data.language, data.name),
        voiceMode: data.voiceMode,
        ttsPreset: data.ttsPreset,
        customTtsReference,
      })
      .where(eq(aiMentorLessons.lessonId, lessonId));
  }

  async createAiMentorLessonData(
    data: {
      lessonId: UUIDType;
      name?: string;
      voiceMode: AiMentorVoiceMode;
      ttsPreset: AiMentorTTSPreset;
      customTtsReference?: string | null;
      language: SupportedLanguages;
    },
    dbInstance: DatabasePg = this.db,
  ) {
    const customTtsReference =
      data.customTtsReference === undefined
        ? undefined
        : buildJsonbField(data.language, data.customTtsReference, true);

    const { language } = data;

    return dbInstance
      .insert(aiMentorLessons)
      .values({
        lessonId: data.lessonId,
        name: buildJsonbField(language, data.name ?? "AI Mentor"),
        voiceMode: data.voiceMode,
        ttsPreset: data.ttsPreset,
        customTtsReference,
      })
      .returning();
  }

  async getMaxDisplayOrder(chapterId: UUIDType, dbInstance: DatabasePg = this.db) {
    const [result] = await dbInstance
      .select({
        maxOrder: sql<number>`COALESCE(max(${lessons.displayOrder}), 0)`,
      })
      .from(lessons)
      .where(eq(lessons.chapterId, chapterId));

    return result.maxOrder;
  }

  async removeLesson(lessonId: UUIDType, dbInstance: DatabasePg = this.db) {
    return dbInstance.delete(lessons).where(eq(lessons.id, lessonId)).returning();
  }

  async updateLessonCountForChapter(chapterId: UUIDType, dbInstance: DatabasePg = this.db) {
    return dbInstance.execute(sql`
      UPDATE ${chapters}
      SET lesson_count = (
        SELECT count(*)
        FROM ${lessons}
        WHERE ${lessons.chapterId} = ${chapters.id}
      )
      WHERE ${chapters.id} = ${chapterId}
    `);
  }

  async getLiveLessonByLessonIdAndLanguage(
    lessonId: UUIDType,
    language: SupportedLanguages,
    dbInstance: DatabasePg = this.db,
  ) {
    const [liveLesson] = await dbInstance
      .select({ id: liveLessons.id })
      .from(liveLessons)
      .where(and(eq(liveLessons.lessonId, lessonId), eq(liveLessons.language, language)));

    return liveLesson ?? null;
  }

  async getResolvedLiveLessonByLessonId(
    lessonId: UUIDType,
    language: SupportedLanguages,
    baseLanguage: SupportedLanguages,
    dbInstance: DatabasePg = this.db,
  ) {
    const [liveLesson] = await dbInstance
      .select({
        id: liveLessons.id,
        liveTrainingId: liveLessons.liveTrainingId,
        language: liveLessons.language,
      })
      .from(liveLessons)
      .where(
        and(
          eq(liveLessons.lessonId, lessonId),
          inArray(liveLessons.language, [language, baseLanguage]),
        ),
      )
      .orderBy(sql`CASE WHEN ${liveLessons.language} = ${language} THEN 0 ELSE 1 END`)
      .limit(1);

    return liveLesson ?? null;
  }

  async createLiveLesson(data: CreateLiveLessonInput, dbInstance: DatabasePg = this.db) {
    const [liveLesson] = await dbInstance
      .insert(liveLessons)
      .values(data)
      .returning({ id: liveLessons.id });

    return liveLesson;
  }

  async updateLessonDisplayOrderAfterRemove(chapterId: UUIDType, dbInstance: DatabasePg = this.db) {
    return dbInstance.execute(sql`
        WITH ranked_chapters AS (
          SELECT id, row_number() OVER (ORDER BY display_order) AS new_display_order
          FROM ${lessons}
          WHERE chapter_id = ${chapterId}
        )
        UPDATE ${lessons} cc
        SET display_order = rc.new_display_order
        FROM ranked_chapters rc
        WHERE cc.id = rc.id
          AND cc.chapter_id = ${chapterId}
      `);
  }

  async updateLessonDisplayOrder(
    chapterId: UUIDType,
    lessonId: UUIDType,
    newDisplayOrder: number,
    oldDisplayOrder: number,
  ) {
    await this.db
      .update(lessons)
      .set({
        displayOrder: sql`CASE
                WHEN ${eq(lessons.id, lessonId)}
                  THEN ${newDisplayOrder}
                WHEN ${newDisplayOrder < oldDisplayOrder}
                  AND ${gte(lessons.displayOrder, newDisplayOrder)}
                  AND ${lte(lessons.displayOrder, oldDisplayOrder)}
                  THEN ${lessons.displayOrder} + 1
                WHEN ${newDisplayOrder > oldDisplayOrder}
                  AND ${lte(lessons.displayOrder, newDisplayOrder)}
                  AND ${gte(lessons.displayOrder, oldDisplayOrder)}
                  THEN ${lessons.displayOrder} - 1
                ELSE ${lessons.displayOrder}
              END
              `,
      })
      .where(eq(lessons.chapterId, chapterId));
  }

  async getLessonResourcesForLesson(
    lessonId: UUIDType,
    language?: SupportedLanguages,
    dbInstance: DatabasePg = this.db,
  ) {
    const resourceSelect = language
      ? {
          ...getTableColumns(resources),
          title: this.localizationService.getFieldByLanguage(resources.title, language),
          description: this.localizationService.getFieldByLanguage(resources.description, language),
        }
      : getTableColumns(resources);

    return dbInstance
      .select({
        ...resourceSelect,
      })
      .from(resourceEntity)
      .innerJoin(resources, eq(resources.id, resourceEntity.resourceId))
      .where(
        and(
          eq(resourceEntity.entityId, lessonId),
          eq(resourceEntity.entityType, ENTITY_TYPE.LESSON),
          eq(resources.archived, false),
        ),
      )
      .orderBy(resources.createdAt);
  }

  async createLessonResources(
    lessonId: UUIDType,
    data: Array<{
      reference: string;
      contentType?: string;
      metadata?: Record<string, unknown>;
      uploadedById?: UUIDType | null;
    }>,
    trx?: DatabasePg,
  ) {
    const dbInstance = trx ?? this.db;
    const createResources = async (tx: DatabasePg) => {
      const insertedResources = await tx
        .insert(resources)
        .values(
          data.map((resource) => ({
            reference: resource.reference,
            contentType: resource.contentType ?? "text/html",
            metadata: settingsToJSONBuildObject(resource.metadata ?? {}),
            uploadedBy: resource.uploadedById ?? null,
          })),
        )
        .returning();

      if (!insertedResources.length) {
        return [];
      }

      await tx.insert(resourceEntity).values(
        insertedResources.map((inserted) => ({
          resourceId: inserted.id,
          entityId: lessonId,
          entityType: ENTITY_TYPE.LESSON,
        })),
      );

      return insertedResources;
    };

    return trx ? createResources(dbInstance) : dbInstance.transaction(createResources);
  }

  async updateLessonResources(
    data: Array<{
      id: UUIDType;
      reference: string;
      contentType?: string;
      metadata?: Record<string, unknown>;
    }>,
    trx?: DatabasePg,
  ) {
    const dbInstance = trx ?? this.db;

    return Promise.all(
      data.map((resource) =>
        dbInstance
          .update(resources)
          .set({
            reference: resource.reference,
            contentType: resource.contentType ?? "text/html",
            metadata: settingsToJSONBuildObject(resource.metadata ?? {}),
          })
          .where(eq(resources.id, resource.id))
          .returning(),
      ),
    );
  }

  async deleteLessonResourcesByIds(resourceIds: UUIDType[], trx?: DatabasePg) {
    if (!resourceIds.length) return [];
    const dbInstance = trx ?? this.db;

    return dbInstance
      .update(resources)
      .set({ archived: true })
      .where(inArray(resources.id, resourceIds))
      .returning();
  }

  async deleteLessonResources(lessonId: UUIDType, trx?: DatabasePg) {
    const dbInstance = trx ?? this.db;
    const resourceIds = await dbInstance
      .select({ id: resources.id })
      .from(resourceEntity)
      .innerJoin(resources, eq(resources.id, resourceEntity.resourceId))
      .where(
        and(
          eq(resourceEntity.entityId, lessonId),
          eq(resourceEntity.entityType, ENTITY_TYPE.LESSON),
        ),
      );

    if (!resourceIds.length) return [];

    return dbInstance
      .update(resources)
      .set({ archived: true })
      .where(
        inArray(
          resources.id,
          resourceIds.map((item) => item.id),
        ),
      )
      .returning();
  }

  async getCourseByLesson(lessonId: UUIDType) {
    return this.db
      .select({
        ...getTableColumns(courses),
        baseLanguage: sql<SupportedLanguages>`${courses.baseLanguage}`,
        availableLocales: sql<SupportedLanguages[]>`${courses.availableLocales}`,
      })
      .from(lessons)
      .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
      .innerJoin(courses, eq(chapters.courseId, courses.id))
      .where(eq(lessons.id, lessonId));
  }

  async getCourseByChapter(chapterId: UUIDType) {
    return this.db
      .select({
        ...getTableColumns(courses),
        baseLanguage: sql<SupportedLanguages>`${courses.baseLanguage}`,
        availableLocales: sql<SupportedLanguages[]>`${courses.availableLocales}`,
      })
      .from(chapters)
      .innerJoin(courses, eq(chapters.courseId, courses.id))
      .where(eq(chapters.id, chapterId));
  }

  async getCourse(courseId: UUIDType) {
    return this.db.select().from(courses).where(eq(courses.id, courseId));
  }

  async updateAiMentorAvatar(lessonId: UUIDType, fileKey: string | null) {
    return this.db
      .update(aiMentorLessons)
      .set({ avatarReference: fileKey })
      .where(eq(aiMentorLessons.lessonId, lessonId));
  }

  async linkResourcesToLesson(
    lessonId: UUIDType,
    resourceIds: UUIDType[],
    dbInstance: DatabasePg = this.db,
  ) {
    return dbInstance.insert(resourceEntity).values(
      resourceIds.map((resourceId) => ({
        resourceId,
        entityType: ENTITY_TYPE.LESSON,
        entityId: lessonId,
      })),
    );
  }
}
