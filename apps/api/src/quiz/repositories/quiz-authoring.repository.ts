import { Inject, Injectable } from "@nestjs/common";
import { ENTITY_TYPES, type SupportedLanguages } from "@repo/shared";
import { and, asc, eq, getTableColumns, inArray } from "drizzle-orm";

import { DatabasePg, type UUIDType } from "src/common";
import { buildJsonbField, deleteJsonbField, setJsonbField } from "src/common/helpers/sqlHelpers";
import { RESOURCE_RELATIONSHIP_TYPES } from "src/file/file.constants";
import { LocalizationService } from "src/localization/localization.service";
import { DB } from "src/storage/db/db.providers";
import {
  assessmentQuestionBlanks,
  assessmentQuestionBlankAnswerSets,
  assessmentQuestionChoiceOptions,
  assessmentQuestionDragAndDropOptions,
  assessmentQuestionOpenTextSettings,
  assessmentQuestions,
  assessmentQuestionScaleOptions,
  assessmentQuestionTrueFalseStatements,
  assessments,
  lessons,
  resourceEntity,
  resources,
} from "src/storage/schema";

import type {
  QuizQuestionInsert,
  QuizScaleOptionInsert,
  QuizChoiceOptionInsert,
  QuizTrueFalseStatementInsert,
  QuizOpenTextSettingsInsert,
  QuizBlankInsert,
  QuizBlankAnswerSetInsert,
  QuizDragAndDropOptionInsert,
  QuizChoiceOptionUpdate,
  QuizTrueFalseStatementUpdate,
  QuizDragAndDropOptionUpdate,
  QuizBlankUpdate,
} from "./quiz-authoring.repository.types";
import type {
  LocalizedChoiceOptionRow,
  LocalizedTrueFalseStatementRow,
  LocalizedScaleOptionRow,
  LocalizedDragAndDropOptionRow,
  BlankAnswerSetRow,
  BlankRow,
  OpenTextSettingsRow,
  PromptImageRow,
  QuizAuthoringQuestion,
  QuizAuthoringScaleOption,
  QuizLessonCreateData,
  QuizLessonUpdateData,
} from "../types/quiz-authoring.types";

@Injectable()
export class QuizAuthoringRepository {
  constructor(
    @Inject(DB) private readonly db: DatabasePg,
    private readonly localizationService: LocalizationService,
  ) {}

  async findAssessmentByLessonId(lessonId: UUIDType, db: DatabasePg = this.db) {
    const [assessment] = await db
      .select()
      .from(assessments)
      .where(eq(assessments.lessonId, lessonId));

    return assessment ?? null;
  }

  async findLesson(lessonId: UUIDType, language: SupportedLanguages, db: DatabasePg = this.db) {
    const [lesson] = await db
      .select({
        id: lessons.id,
        chapterId: lessons.chapterId,
        title: this.localizationService.getFieldByLanguage(lessons.title, language),
        description: this.localizationService.getFieldByLanguage(lessons.description, language),
        displayOrder: lessons.displayOrder,
      })
      .from(lessons)
      .where(eq(lessons.id, lessonId));

    return lesson ?? null;
  }

  async findQuestions(
    assessmentId: UUIDType,
    language: SupportedLanguages,
    db: DatabasePg = this.db,
  ) {
    const questions = await db
      .select({
        ...getTableColumns(assessmentQuestions),
        prompt: this.localizationService.getFieldByLanguage(assessmentQuestions.prompt, language),
        title: this.localizationService.getFieldByLanguage(assessmentQuestions.title, language),
        description: this.localizationService.getFieldByLanguage(
          assessmentQuestions.description,
          language,
        ),
      })
      .from(assessmentQuestions)
      .where(eq(assessmentQuestions.assessmentId, assessmentId))
      .orderBy(asc(assessmentQuestions.displayOrder));

    return questions;
  }

  async findChoiceOptions(
    questionIds: UUIDType[],
    language: SupportedLanguages,
    db: DatabasePg = this.db,
  ): Promise<LocalizedChoiceOptionRow[]> {
    if (!questionIds.length) return [];

    return db
      .select({
        ...getTableColumns(assessmentQuestionChoiceOptions),
        label: assessmentQuestionChoiceOptions.label,
      })
      .from(assessmentQuestionChoiceOptions)
      .where(
        and(
          inArray(assessmentQuestionChoiceOptions.questionId, questionIds),
          eq(assessmentQuestionChoiceOptions.language, language),
        ),
      );
  }

  async findTrueFalseStatements(
    questionIds: UUIDType[],
    language: SupportedLanguages,
    db: DatabasePg = this.db,
  ): Promise<LocalizedTrueFalseStatementRow[]> {
    if (!questionIds.length) return [];

    return db
      .select({
        ...getTableColumns(assessmentQuestionTrueFalseStatements),
        statement: assessmentQuestionTrueFalseStatements.statement,
      })
      .from(assessmentQuestionTrueFalseStatements)
      .where(
        and(
          inArray(assessmentQuestionTrueFalseStatements.questionId, questionIds),
          eq(assessmentQuestionTrueFalseStatements.language, language),
        ),
      );
  }

  async findScaleOptions(
    questionIds: UUIDType[],
    language: SupportedLanguages,
    db: DatabasePg = this.db,
  ): Promise<LocalizedScaleOptionRow[]> {
    if (!questionIds.length) return [];

    return db
      .select({
        ...getTableColumns(assessmentQuestionScaleOptions),
        label: this.localizationService.getFieldByLanguage(
          assessmentQuestionScaleOptions.label,
          language,
        ),
      })
      .from(assessmentQuestionScaleOptions)
      .where(inArray(assessmentQuestionScaleOptions.questionId, questionIds));
  }

  async findOpenTextSettings(
    questionIds: UUIDType[],
    db: DatabasePg = this.db,
  ): Promise<OpenTextSettingsRow[]> {
    if (!questionIds.length) return [];

    return db
      .select()
      .from(assessmentQuestionOpenTextSettings)
      .where(inArray(assessmentQuestionOpenTextSettings.questionId, questionIds));
  }

  async findBlanks(questionIds: UUIDType[], db: DatabasePg = this.db): Promise<BlankRow[]> {
    if (!questionIds.length) return [];

    return db
      .select()
      .from(assessmentQuestionBlanks)
      .where(inArray(assessmentQuestionBlanks.questionId, questionIds))
      .orderBy(
        asc(assessmentQuestionBlanks.questionId),
        asc(assessmentQuestionBlanks.createdAt),
        asc(assessmentQuestionBlanks.id),
      );
  }

  async findDragAndDropOptions(
    questionIds: UUIDType[],
    language: SupportedLanguages,
    db: DatabasePg = this.db,
  ): Promise<LocalizedDragAndDropOptionRow[]> {
    if (!questionIds.length) return [];

    return db
      .select({
        ...getTableColumns(assessmentQuestionDragAndDropOptions),
        label: assessmentQuestionDragAndDropOptions.label,
      })
      .from(assessmentQuestionDragAndDropOptions)
      .where(
        and(
          inArray(assessmentQuestionDragAndDropOptions.questionId, questionIds),
          eq(assessmentQuestionDragAndDropOptions.language, language),
        ),
      );
  }

  async findBlankAnswerSets(
    blankIds: UUIDType[],
    language: SupportedLanguages,
    db: DatabasePg = this.db,
  ): Promise<BlankAnswerSetRow[]> {
    if (!blankIds.length) return [];

    return db
      .select()
      .from(assessmentQuestionBlankAnswerSets)
      .where(
        and(
          inArray(assessmentQuestionBlankAnswerSets.blankId, blankIds),
          eq(assessmentQuestionBlankAnswerSets.language, language),
        ),
      );
  }

  async findPromptImages(
    questionIds: UUIDType[],
    db: DatabasePg = this.db,
  ): Promise<PromptImageRow[]> {
    if (!questionIds.length) return [];

    return db
      .select({ questionId: resourceEntity.entityId, reference: resources.reference })
      .from(resourceEntity)
      .innerJoin(resources, eq(resources.id, resourceEntity.resourceId))
      .where(
        and(
          inArray(resourceEntity.entityId, questionIds),
          eq(resourceEntity.entityType, ENTITY_TYPES.ASSESSMENT_QUESTION),
          eq(resourceEntity.relationshipType, RESOURCE_RELATIONSHIP_TYPES.PROMPT_IMAGE),
          eq(resources.archived, false),
        ),
      );
  }
  withTransaction<T>(work: (trx: DatabasePg) => Promise<T>, db: DatabasePg = this.db): Promise<T> {
    return db.transaction(work);
  }

  async insertLesson(
    lesson: QuizLessonCreateData["lesson"],
    language: SupportedLanguages,
    trx: DatabasePg,
  ) {
    const [createdLesson] = await trx
      .insert(lessons)
      .values({
        ...lesson,
        title: buildJsonbField(language, lesson.title),
        description:
          lesson.description == null ? null : buildJsonbField(language, lesson.description),
      })
      .returning();

    return createdLesson;
  }

  async updateLesson(lessonId: UUIDType, lesson: QuizLessonUpdateData["lesson"], trx: DatabasePg) {
    const lessonUpdate = {
      title: setJsonbField(lessons.title, lesson.language, lesson.title, true, true),
      description:
        lesson.description === null
          ? deleteJsonbField(lessons.description, lesson.language)
          : setJsonbField(lessons.description, lesson.language, lesson.description, true, true),
      thresholdScore: lesson.thresholdScore,
      attemptsLimit: lesson.attemptsLimit,
      quizCooldownInHours: lesson.quizCooldownInHours,
    };
    if (Object.values(lessonUpdate).some((value) => value !== undefined)) {
      await trx.update(lessons).set(lessonUpdate).where(eq(lessons.id, lessonId));
    }
  }

  async updateAssessment(
    lessonId: UUIDType,
    values: QuizLessonUpdateData["assessment"],
    trx: DatabasePg,
  ) {
    const [assessment] = await trx
      .update(assessments)
      .set(values)
      .where(eq(assessments.lessonId, lessonId))
      .returning();
    return assessment ?? null;
  }

  async insertAssessment(
    data: QuizLessonCreateData["assessment"] & { lessonId: UUIDType },
    trx: DatabasePg,
  ) {
    const [assessment] = await trx.insert(assessments).values(data).returning();
    return assessment;
  }

  async insertChoiceOptions(values: QuizChoiceOptionInsert[], trx: DatabasePg) {
    if (!values.length) return;
    await trx.insert(assessmentQuestionChoiceOptions).values(values);
  }

  async insertTrueFalseStatements(values: QuizTrueFalseStatementInsert[], trx: DatabasePg) {
    if (!values.length) return;
    await trx.insert(assessmentQuestionTrueFalseStatements).values(values);
  }

  async insertOpenTextSettings(values: QuizOpenTextSettingsInsert[], trx: DatabasePg) {
    if (!values.length) return;
    await trx.insert(assessmentQuestionOpenTextSettings).values(values);
  }

  async insertBlanks(values: QuizBlankInsert[], trx: DatabasePg) {
    if (!values.length) return;
    await trx.insert(assessmentQuestionBlanks).values(values);
  }

  async insertBlankAnswerSets(values: QuizBlankAnswerSetInsert[], trx: DatabasePg) {
    if (!values.length) return;
    await trx.insert(assessmentQuestionBlankAnswerSets).values(values);
  }

  async insertDragAndDropOptions(values: QuizDragAndDropOptionInsert[], trx: DatabasePg) {
    if (!values.length) return;
    await trx.insert(assessmentQuestionDragAndDropOptions).values(values);
  }

  async insertQuestions(
    values: QuizQuestionInsert[],
    language: SupportedLanguages,
    trx: DatabasePg,
  ) {
    if (!values.length) return;
    await trx.insert(assessmentQuestions).values(
      values.map((question) => ({
        ...question,
        prompt: buildJsonbField(language, question.prompt),
        title: buildJsonbField(language, question.title),
        description:
          question.description == null ? null : buildJsonbField(language, question.description),
      })),
    );
  }

  async insertScaleOptions(
    values: QuizScaleOptionInsert[],
    language: SupportedLanguages,
    trx: DatabasePg,
  ) {
    if (!values.length) return;
    await trx.insert(assessmentQuestionScaleOptions).values(
      values.map((option) => ({
        ...option,
        label: buildJsonbField(language, option.label),
      })),
    );
  }

  async findQuestionIds(assessmentId: UUIDType, trx: DatabasePg) {
    return trx
      .select({ id: assessmentQuestions.id })
      .from(assessmentQuestions)
      .where(eq(assessmentQuestions.assessmentId, assessmentId));
  }

  async deleteQuestionResources(questionIds: UUIDType[], trx: DatabasePg) {
    if (!questionIds.length) return;
    await trx
      .delete(resourceEntity)
      .where(
        and(
          inArray(resourceEntity.entityId, questionIds),
          eq(resourceEntity.entityType, ENTITY_TYPES.ASSESSMENT_QUESTION),
        ),
      );
  }

  async deleteQuestions(questionIds: UUIDType[], trx: DatabasePg) {
    if (!questionIds.length) return;
    await trx.delete(assessmentQuestions).where(inArray(assessmentQuestions.id, questionIds));
  }

  async updateQuestion(
    question: QuizAuthoringQuestion,
    language: SupportedLanguages,
    trx: DatabasePg,
  ) {
    await trx
      .update(assessmentQuestions)
      .set({
        questionType: question.questionType,
        displayOrder: question.displayOrder,
        maximumPoints: question.maximumPoints,
        gradingMode: question.gradingMode,
        prompt: setJsonbField(assessmentQuestions.prompt, language, question.prompt, true, true),
        title: setJsonbField(assessmentQuestions.title, language, question.title, true, true),
        description:
          question.description == null
            ? deleteJsonbField(assessmentQuestions.description, language)
            : setJsonbField(
                assessmentQuestions.description,
                language,
                question.description,
                true,
                true,
              ),
      })
      .where(eq(assessmentQuestions.id, question.id));
  }

  async deleteChoiceOptions(questionIds: UUIDType[], ids: UUIDType[], trx: DatabasePg) {
    if (!ids.length) return;
    await trx
      .delete(assessmentQuestionChoiceOptions)
      .where(
        and(
          inArray(assessmentQuestionChoiceOptions.questionId, questionIds),
          inArray(assessmentQuestionChoiceOptions.id, ids),
        ),
      );
  }

  async deleteTrueFalseStatements(questionIds: UUIDType[], ids: UUIDType[], trx: DatabasePg) {
    if (!ids.length) return;
    await trx
      .delete(assessmentQuestionTrueFalseStatements)
      .where(
        and(
          inArray(assessmentQuestionTrueFalseStatements.questionId, questionIds),
          inArray(assessmentQuestionTrueFalseStatements.id, ids),
        ),
      );
  }

  async deleteDragAndDropOptions(questionIds: UUIDType[], ids: UUIDType[], trx: DatabasePg) {
    if (!ids.length) return;
    await trx
      .delete(assessmentQuestionDragAndDropOptions)
      .where(
        and(
          inArray(assessmentQuestionDragAndDropOptions.questionId, questionIds),
          inArray(assessmentQuestionDragAndDropOptions.id, ids),
        ),
      );
  }

  async deleteOpenTextSettings(questionIds: UUIDType[], trx: DatabasePg) {
    await trx
      .delete(assessmentQuestionOpenTextSettings)
      .where(inArray(assessmentQuestionOpenTextSettings.questionId, questionIds));
  }

  async updateChoiceOption(id: UUIDType, values: QuizChoiceOptionUpdate, trx: DatabasePg) {
    await trx
      .update(assessmentQuestionChoiceOptions)
      .set(values)
      .where(eq(assessmentQuestionChoiceOptions.id, id));
  }

  async updateTrueFalseStatement(
    id: UUIDType,
    values: QuizTrueFalseStatementUpdate,
    trx: DatabasePg,
  ) {
    await trx
      .update(assessmentQuestionTrueFalseStatements)
      .set(values)
      .where(eq(assessmentQuestionTrueFalseStatements.id, id));
  }

  async updateDragAndDropOption(
    id: UUIDType,
    values: QuizDragAndDropOptionUpdate,
    trx: DatabasePg,
  ) {
    await trx
      .update(assessmentQuestionDragAndDropOptions)
      .set(values)
      .where(eq(assessmentQuestionDragAndDropOptions.id, id));
  }

  async updateBlank(id: UUIDType, values: QuizBlankUpdate, trx: DatabasePg) {
    await trx
      .update(assessmentQuestionBlanks)
      .set(values)
      .where(eq(assessmentQuestionBlanks.id, id));
  }

  async findScaleOptionRows(questionIds: UUIDType[], trx: DatabasePg) {
    if (!questionIds.length) return [];
    return trx
      .select()
      .from(assessmentQuestionScaleOptions)
      .where(inArray(assessmentQuestionScaleOptions.questionId, questionIds));
  }

  async deleteScaleOptions(ids: UUIDType[], trx: DatabasePg) {
    if (!ids.length) return;
    await trx
      .delete(assessmentQuestionScaleOptions)
      .where(inArray(assessmentQuestionScaleOptions.id, ids));
  }

  async deleteBlanks(ids: UUIDType[], trx: DatabasePg) {
    if (!ids.length) return;
    await trx.delete(assessmentQuestionBlanks).where(inArray(assessmentQuestionBlanks.id, ids));
  }

  async updateScaleOption(
    option: QuizAuthoringScaleOption,
    language: SupportedLanguages,
    trx: DatabasePg,
  ) {
    await trx
      .update(assessmentQuestionScaleOptions)
      .set({
        displayOrder: option.displayOrder,
        scaleValue: option.scaleValue,
        label: setJsonbField(
          assessmentQuestionScaleOptions.label,
          language,
          option.label,
          true,
          true,
        ),
      })
      .where(eq(assessmentQuestionScaleOptions.id, option.id));
  }

  async deleteBlankAnswerSets(
    blankIdsToSync: UUIDType[],
    language: SupportedLanguages,
    trx: DatabasePg,
  ) {
    await trx
      .delete(assessmentQuestionBlankAnswerSets)
      .where(
        and(
          inArray(assessmentQuestionBlankAnswerSets.blankId, blankIdsToSync),
          eq(assessmentQuestionBlankAnswerSets.language, language),
        ),
      );
  }

  async clearPromptImageRelations(questionIds: UUIDType[], trx: DatabasePg) {
    await trx
      .delete(resourceEntity)
      .where(
        and(
          inArray(resourceEntity.entityId, questionIds),
          eq(resourceEntity.entityType, ENTITY_TYPES.ASSESSMENT_QUESTION),
          eq(resourceEntity.relationshipType, RESOURCE_RELATIONSHIP_TYPES.PROMPT_IMAGE),
        ),
      );
  }
}
