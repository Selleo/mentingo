import { Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";

import { DatabasePg, type UUIDType } from "src/common";
import { buildJsonbField, deleteJsonbField, setJsonbField } from "src/common/helpers/sqlHelpers";
import { DB } from "src/storage/db/db.providers";
import {
  aiMentorConfigurations,
  aiMentorLessons,
  aiMentorRoleplayConfigurations,
  aiMentorTeacherConfigurations,
  chapters,
  courses,
  lessons,
} from "src/storage/schema";

import type {
  AiMentorConfigurationContent,
  AiMentorRoleplayConfigurationContent,
  AiMentorTeacherConfigurationContent,
  UpdateAiMentorConfigurationTranslationBody,
  UpdateAiMentorRoleplayConfigurationTranslationBody,
  UpdateAiMentorTeacherConfigurationTranslationBody,
} from "../schemas/ai-mentor-configuration.schema";
import type {
  AiMentorConfigurationLessonContext,
  AiMentorGenerationAuthoringContext,
} from "../types/ai-mentor-configuration.types";
import type { SupportedLanguages } from "@repo/shared";

@Injectable()
export class AiMentorConfigurationRepository {
  constructor(@Inject(DB) private readonly db: DatabasePg) {}

  async findLessonContext(
    lessonId: UUIDType,
    dbInstance: DatabasePg = this.db,
  ): Promise<AiMentorConfigurationLessonContext | undefined> {
    const [context] = await dbInstance
      .select({
        courseId: courses.id,
        lessonId: lessons.id,
        lessonType: lessons.type,
        aiMentorLessonId: aiMentorLessons.id,
        configurationId: aiMentorConfigurations.id,
        configurationType: aiMentorConfigurations.type,
        baseLanguage: courses.baseLanguage,
        availableLocales: courses.availableLocales,
      })
      .from(lessons)
      .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
      .innerJoin(courses, eq(courses.id, chapters.courseId))
      .leftJoin(aiMentorLessons, eq(aiMentorLessons.lessonId, lessons.id))
      .leftJoin(
        aiMentorConfigurations,
        eq(aiMentorConfigurations.aiMentorLessonId, aiMentorLessons.id),
      )
      .where(eq(lessons.id, lessonId));

    return context;
  }

  async findCourseAuthoringContext(
    courseId: UUIDType,
  ): Promise<AiMentorGenerationAuthoringContext | undefined> {
    const [context] = await this.db
      .select({
        courseId: courses.id,
        baseLanguage: courses.baseLanguage,
      })
      .from(courses)
      .where(eq(courses.id, courseId));

    return context;
  }

  async findConfigurationRoot(configurationId: UUIDType, dbInstance: DatabasePg = this.db) {
    const [configuration] = await dbInstance
      .select()
      .from(aiMentorConfigurations)
      .where(eq(aiMentorConfigurations.id, configurationId));

    return configuration;
  }

  async findTeacherConfiguration(configurationId: UUIDType, dbInstance: DatabasePg = this.db) {
    const [configuration] = await dbInstance
      .select()
      .from(aiMentorTeacherConfigurations)
      .where(eq(aiMentorTeacherConfigurations.configurationId, configurationId));

    return configuration;
  }

  async findRoleplayConfiguration(configurationId: UUIDType, dbInstance: DatabasePg = this.db) {
    const [configuration] = await dbInstance
      .select()
      .from(aiMentorRoleplayConfigurations)
      .where(eq(aiMentorRoleplayConfigurations.configurationId, configurationId));

    return configuration;
  }

  async getConfigurationsForCourse(courseId: UUIDType) {
    return this.db
      .select({
        configurationId: aiMentorConfigurations.id,
        type: aiMentorConfigurations.type,
        openingInstruction: aiMentorConfigurations.openingInstruction,
        additionalInstructions: aiMentorConfigurations.additionalInstructions,
        teacherConfigurationId: aiMentorTeacherConfigurations.id,
        taskGoal: aiMentorTeacherConfigurations.taskGoal,
        expertise: aiMentorTeacherConfigurations.expertise,
        contentScope: aiMentorTeacherConfigurations.contentScope,
        feedbackGuidance: aiMentorTeacherConfigurations.feedbackGuidance,
        roleplayConfigurationId: aiMentorRoleplayConfigurations.id,
        scenario: aiMentorRoleplayConfigurations.scenario,
        aiRole: aiMentorRoleplayConfigurations.aiRole,
        learnerRole: aiMentorRoleplayConfigurations.learnerRole,
        characterGoal: aiMentorRoleplayConfigurations.characterGoal,
        factsAndConstraints: aiMentorRoleplayConfigurations.factsAndConstraints,
        courseTitle: courses.title,
        lessonTitle: lessons.title,
        lessonDescription: lessons.description,
      })
      .from(aiMentorConfigurations)
      .innerJoin(aiMentorLessons, eq(aiMentorLessons.id, aiMentorConfigurations.aiMentorLessonId))
      .innerJoin(lessons, eq(lessons.id, aiMentorLessons.lessonId))
      .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
      .innerJoin(courses, eq(courses.id, chapters.courseId))
      .leftJoin(
        aiMentorTeacherConfigurations,
        eq(aiMentorTeacherConfigurations.configurationId, aiMentorConfigurations.id),
      )
      .leftJoin(
        aiMentorRoleplayConfigurations,
        eq(aiMentorRoleplayConfigurations.configurationId, aiMentorConfigurations.id),
      )
      .where(eq(courses.id, courseId));
  }

  async createConfigurationRoot(
    aiMentorLessonId: UUIDType,
    data: AiMentorConfigurationContent,
    language: SupportedLanguages,
    dbInstance: DatabasePg,
  ) {
    const [configuration] = await dbInstance
      .insert(aiMentorConfigurations)
      .values({
        aiMentorLessonId,
        type: data.type,
        openingInstruction: buildJsonbField(language, data.openingInstruction),
        additionalInstructions: buildJsonbField(language, data.additionalInstructions),
      })
      .returning();

    return configuration;
  }

  async createTeacherConfiguration(
    configurationId: UUIDType,
    data: AiMentorTeacherConfigurationContent,
    language: SupportedLanguages,
    dbInstance: DatabasePg,
  ) {
    const [configuration] = await dbInstance
      .insert(aiMentorTeacherConfigurations)
      .values({
        configurationId,
        taskGoal: buildJsonbField(language, data.taskGoal),
        expertise: buildJsonbField(language, data.expertise),
        contentScope: buildJsonbField(language, data.contentScope),
        teachingStyle: data.teachingStyle,
        feedbackGuidance: buildJsonbField(language, data.feedbackGuidance),
      })
      .returning();

    return configuration;
  }

  async createRoleplayConfiguration(
    configurationId: UUIDType,
    data: AiMentorRoleplayConfigurationContent,
    language: SupportedLanguages,
    dbInstance: DatabasePg,
  ) {
    const [configuration] = await dbInstance
      .insert(aiMentorRoleplayConfigurations)
      .values({
        configurationId,
        scenario: buildJsonbField(language, data.scenario),
        aiRole: buildJsonbField(language, data.aiRole),
        learnerRole: buildJsonbField(language, data.learnerRole),
        characterGoal: buildJsonbField(language, data.characterGoal),
        difficulty: data.difficulty,
        factsAndConstraints: buildJsonbField(language, data.factsAndConstraints),
      })
      .returning();

    return configuration;
  }

  async updateConfigurationRoot(
    configurationId: UUIDType,
    data: AiMentorConfigurationContent,
    language: SupportedLanguages,
    dbInstance: DatabasePg,
  ) {
    const [configuration] = await dbInstance
      .update(aiMentorConfigurations)
      .set({
        type: data.type,
        openingInstruction: this.replaceLocalizedValue(
          aiMentorConfigurations.openingInstruction,
          language,
          data.openingInstruction,
        ),
        additionalInstructions: this.replaceLocalizedValue(
          aiMentorConfigurations.additionalInstructions,
          language,
          data.additionalInstructions,
        ),
      })
      .where(eq(aiMentorConfigurations.id, configurationId))
      .returning();

    return configuration;
  }

  async updateTeacherConfiguration(
    configurationId: UUIDType,
    data: AiMentorTeacherConfigurationContent,
    language: SupportedLanguages,
    dbInstance: DatabasePg,
  ) {
    const [configuration] = await dbInstance
      .update(aiMentorTeacherConfigurations)
      .set({
        taskGoal: setJsonbField(aiMentorTeacherConfigurations.taskGoal, language, data.taskGoal),
        expertise: setJsonbField(aiMentorTeacherConfigurations.expertise, language, data.expertise),
        contentScope: setJsonbField(
          aiMentorTeacherConfigurations.contentScope,
          language,
          data.contentScope,
        ),
        teachingStyle: data.teachingStyle,
        feedbackGuidance: this.replaceLocalizedValue(
          aiMentorTeacherConfigurations.feedbackGuidance,
          language,
          data.feedbackGuidance,
        ),
      })
      .where(eq(aiMentorTeacherConfigurations.configurationId, configurationId))
      .returning();

    return configuration;
  }

  async updateRoleplayConfiguration(
    configurationId: UUIDType,
    data: AiMentorRoleplayConfigurationContent,
    language: SupportedLanguages,
    dbInstance: DatabasePg,
  ) {
    const [configuration] = await dbInstance
      .update(aiMentorRoleplayConfigurations)
      .set({
        scenario: setJsonbField(aiMentorRoleplayConfigurations.scenario, language, data.scenario),
        aiRole: setJsonbField(aiMentorRoleplayConfigurations.aiRole, language, data.aiRole),
        learnerRole: setJsonbField(
          aiMentorRoleplayConfigurations.learnerRole,
          language,
          data.learnerRole,
        ),
        characterGoal: setJsonbField(
          aiMentorRoleplayConfigurations.characterGoal,
          language,
          data.characterGoal,
        ),
        difficulty: data.difficulty,
        factsAndConstraints: this.replaceLocalizedValue(
          aiMentorRoleplayConfigurations.factsAndConstraints,
          language,
          data.factsAndConstraints,
        ),
      })
      .where(eq(aiMentorRoleplayConfigurations.configurationId, configurationId))
      .returning();

    return configuration;
  }

  async updateConfigurationRootTranslations(
    configurationId: UUIDType,
    language: SupportedLanguages,
    data: UpdateAiMentorConfigurationTranslationBody,
    dbInstance: DatabasePg,
  ) {
    await dbInstance
      .update(aiMentorConfigurations)
      .set({
        openingInstruction: this.patchLocalizedValue(
          aiMentorConfigurations.openingInstruction,
          language,
          data.openingInstruction,
        ),
        additionalInstructions: this.patchLocalizedValue(
          aiMentorConfigurations.additionalInstructions,
          language,
          data.additionalInstructions,
        ),
      })
      .where(eq(aiMentorConfigurations.id, configurationId));
  }

  async updateTeacherConfigurationTranslations(
    configurationId: UUIDType,
    language: SupportedLanguages,
    data: UpdateAiMentorTeacherConfigurationTranslationBody,
    dbInstance: DatabasePg,
  ) {
    const [configuration] = await dbInstance
      .update(aiMentorTeacherConfigurations)
      .set({
        taskGoal: this.patchLocalizedValue(
          aiMentorTeacherConfigurations.taskGoal,
          language,
          data.taskGoal,
        ),
        expertise: this.patchLocalizedValue(
          aiMentorTeacherConfigurations.expertise,
          language,
          data.expertise,
        ),
        contentScope: this.patchLocalizedValue(
          aiMentorTeacherConfigurations.contentScope,
          language,
          data.contentScope,
        ),
        feedbackGuidance: this.patchLocalizedValue(
          aiMentorTeacherConfigurations.feedbackGuidance,
          language,
          data.feedbackGuidance,
        ),
      })
      .where(eq(aiMentorTeacherConfigurations.configurationId, configurationId))
      .returning();

    return configuration;
  }

  async updateRoleplayConfigurationTranslations(
    configurationId: UUIDType,
    language: SupportedLanguages,
    data: UpdateAiMentorRoleplayConfigurationTranslationBody,
    dbInstance: DatabasePg,
  ) {
    const [configuration] = await dbInstance
      .update(aiMentorRoleplayConfigurations)
      .set({
        scenario: this.patchLocalizedValue(
          aiMentorRoleplayConfigurations.scenario,
          language,
          data.scenario,
        ),
        aiRole: this.patchLocalizedValue(
          aiMentorRoleplayConfigurations.aiRole,
          language,
          data.aiRole,
        ),
        learnerRole: this.patchLocalizedValue(
          aiMentorRoleplayConfigurations.learnerRole,
          language,
          data.learnerRole,
        ),
        characterGoal: this.patchLocalizedValue(
          aiMentorRoleplayConfigurations.characterGoal,
          language,
          data.characterGoal,
        ),
        factsAndConstraints: this.patchLocalizedValue(
          aiMentorRoleplayConfigurations.factsAndConstraints,
          language,
          data.factsAndConstraints,
        ),
      })
      .where(eq(aiMentorRoleplayConfigurations.configurationId, configurationId))
      .returning();

    return configuration;
  }

  async deleteTeacherConfiguration(configurationId: UUIDType, dbInstance: DatabasePg) {
    await dbInstance
      .delete(aiMentorTeacherConfigurations)
      .where(eq(aiMentorTeacherConfigurations.configurationId, configurationId));
  }

  async deleteRoleplayConfiguration(configurationId: UUIDType, dbInstance: DatabasePg) {
    await dbInstance
      .delete(aiMentorRoleplayConfigurations)
      .where(eq(aiMentorRoleplayConfigurations.configurationId, configurationId));
  }

  private replaceLocalizedValue(
    field: Parameters<typeof deleteJsonbField>[0],
    language: SupportedLanguages,
    value: string | null | undefined,
  ) {
    return value ? setJsonbField(field, language, value) : deleteJsonbField(field, language);
  }

  private patchLocalizedValue(
    field: Parameters<typeof deleteJsonbField>[0],
    language: SupportedLanguages,
    value: string | null | undefined,
  ) {
    if (value === undefined) return undefined;

    return value === null
      ? deleteJsonbField(field, language)
      : setJsonbField(field, language, value);
  }
}
