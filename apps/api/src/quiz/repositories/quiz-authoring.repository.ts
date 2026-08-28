import { Inject, Injectable } from "@nestjs/common";
import { ENTITY_TYPES, type SupportedLanguages } from "@repo/shared";
import { and, eq, getTableColumns, inArray } from "drizzle-orm";

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

import {
  mapBlankChanges,
  mapLocalizedQuestionChildChanges,
  mapScaleOptionChanges,
} from "../mappers/legacy-to-quiz-authoring.mapper";

import type {
  BlankAnswerSetRow,
  BlankRow,
  ChoiceOptionRow,
  DragAndDropOptionRow,
  OpenTextSettingsRow,
  PromptImageRow,
  QuizAuthoringQuestion,
  QuizLessonCreateData,
  QuizLessonUpdateData,
  ScaleOptionRow,
  TrueFalseStatementRow,
} from "../types/quiz-authoring.types";

type LocalizedChoiceOptionRow = Omit<ChoiceOptionRow, "label"> & { label: string };
type LocalizedTrueFalseStatementRow = Omit<TrueFalseStatementRow, "statement"> & {
  statement: string;
};
type LocalizedScaleOptionRow = Omit<ScaleOptionRow, "label"> & { label: string };
type LocalizedDragAndDropOptionRow = Omit<DragAndDropOptionRow, "label"> & { label: string };

@Injectable()
export class QuizAuthoringRepository {
  constructor(
    @Inject(DB) private readonly db: DatabasePg,
    private readonly localizationService: LocalizationService,
  ) {}

  async createQuizLesson(data: QuizLessonCreateData, db: DatabasePg = this.db) {
    return db.transaction(async (trx) => {
      const [lesson] = await trx
        .insert(lessons)
        .values({
          ...data.lesson,
          title: buildJsonbField(data.language, data.lesson.title),
          description:
            data.lesson.description == null
              ? null
              : buildJsonbField(data.language, data.lesson.description),
        })
        .returning();

      const assessment = await this.createAssessmentForLesson(
        { ...data.assessment, lessonId: lesson.id },
        trx,
      );

      await this.insertAssessmentQuestions(assessment.id, data.questions, data.language, trx);

      return lesson;
    });
  }

  async updateQuizLesson(
    { lesson, lessonId, assessment: assessmentData, questions }: QuizLessonUpdateData,
    db: DatabasePg = this.db,
  ) {
    return db.transaction(async (trx) => {
      await trx
        .update(lessons)
        .set({
          title: setJsonbField(lessons.title, lesson.language, lesson.title, true, true),
          description:
            lesson.description === null
              ? deleteJsonbField(lessons.description, lesson.language)
              : setJsonbField(lessons.description, lesson.language, lesson.description, true, true),
          thresholdScore: lesson.thresholdScore,
          attemptsLimit: lesson.attemptsLimit,
          quizCooldownInHours: lesson.quizCooldownInHours,
        })
        .where(eq(lessons.id, lessonId));

      const [assessment] = await trx
        .update(assessments)
        .set(assessmentData)
        .where(eq(assessments.lessonId, lessonId))
        .returning();

      if (!assessment) return null;

      if (questions)
        await this.syncAssessmentQuestions(assessment.id, questions, lesson.language, trx);

      return assessment;
    });
  }

  async findAssessmentByLessonId(lessonId: UUIDType, db: DatabasePg = this.db) {
    const [assessment] = await db
      .select()
      .from(assessments)
      .where(eq(assessments.lessonId, lessonId));

    return assessment ?? null;
  }

  async getQuizLessonForAuthoring(
    lessonId: UUIDType,
    language: SupportedLanguages,
    db: DatabasePg = this.db,
  ) {
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

    const assessment = await this.findAssessmentByLessonId(lessonId, db);

    if (!lesson || !assessment) return null;

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
      .where(eq(assessmentQuestions.assessmentId, assessment.id));

    const questionIds = questions.map(({ id }) => id);

    const [
      choiceOptions,
      trueFalseStatements,
      scaleOptions,
      openTextSettings,
      blanks,
      dragOptions,
    ] = await Promise.all([
      this.findChoiceOptions(questionIds, language, db),
      this.findTrueFalseStatements(questionIds, language, db),
      this.findScaleOptions(questionIds, language, db),
      this.findOpenTextSettings(questionIds, db),
      this.findBlanks(questionIds, db),
      this.findDragAndDropOptions(questionIds, language, db),
    ]);

    const blankIds = blanks.map(({ id }) => id);

    const [answerSets, promptImages] = await Promise.all([
      this.findBlankAnswerSets(blankIds, language, db),
      this.findPromptImages(questionIds, db),
    ]);

    return {
      lesson,
      assessment,
      questions,
      choiceOptions,
      trueFalseStatements,
      scaleOptions,
      openTextSettings,
      blanks,
      answerSets,
      dragOptions,
      promptImages,
    };
  }

  private async findChoiceOptions(
    questionIds: UUIDType[],
    language: SupportedLanguages,
    db: DatabasePg,
  ): Promise<LocalizedChoiceOptionRow[]> {
    if (!questionIds.length) return [];

    return db
      .select({
        ...getTableColumns(assessmentQuestionChoiceOptions),
        label: this.localizationService.getFieldByLanguage(
          assessmentQuestionChoiceOptions.label,
          language,
        ),
      })
      .from(assessmentQuestionChoiceOptions)
      .where(
        and(
          inArray(assessmentQuestionChoiceOptions.questionId, questionIds),
          eq(assessmentQuestionChoiceOptions.language, language),
        ),
      );
  }

  private async findTrueFalseStatements(
    questionIds: UUIDType[],
    language: SupportedLanguages,
    db: DatabasePg,
  ): Promise<LocalizedTrueFalseStatementRow[]> {
    if (!questionIds.length) return [];

    return db
      .select({
        ...getTableColumns(assessmentQuestionTrueFalseStatements),
        statement: this.localizationService.getFieldByLanguage(
          assessmentQuestionTrueFalseStatements.statement,
          language,
        ),
      })
      .from(assessmentQuestionTrueFalseStatements)
      .where(
        and(
          inArray(assessmentQuestionTrueFalseStatements.questionId, questionIds),
          eq(assessmentQuestionTrueFalseStatements.language, language),
        ),
      );
  }

  private async findScaleOptions(
    questionIds: UUIDType[],
    language: SupportedLanguages,
    db: DatabasePg,
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

  private async findOpenTextSettings(
    questionIds: UUIDType[],
    db: DatabasePg,
  ): Promise<OpenTextSettingsRow[]> {
    if (!questionIds.length) return [];

    return db
      .select()
      .from(assessmentQuestionOpenTextSettings)
      .where(inArray(assessmentQuestionOpenTextSettings.questionId, questionIds));
  }

  private async findBlanks(questionIds: UUIDType[], db: DatabasePg): Promise<BlankRow[]> {
    if (!questionIds.length) return [];

    return db
      .select()
      .from(assessmentQuestionBlanks)
      .where(inArray(assessmentQuestionBlanks.questionId, questionIds));
  }

  private async findDragAndDropOptions(
    questionIds: UUIDType[],
    language: SupportedLanguages,
    db: DatabasePg,
  ): Promise<LocalizedDragAndDropOptionRow[]> {
    if (!questionIds.length) return [];

    return db
      .select({
        ...getTableColumns(assessmentQuestionDragAndDropOptions),
        label: this.localizationService.getFieldByLanguage(
          assessmentQuestionDragAndDropOptions.label,
          language,
        ),
      })
      .from(assessmentQuestionDragAndDropOptions)
      .where(
        and(
          inArray(assessmentQuestionDragAndDropOptions.questionId, questionIds),
          eq(assessmentQuestionDragAndDropOptions.language, language),
        ),
      );
  }

  private async findBlankAnswerSets(
    blankIds: UUIDType[],
    language: SupportedLanguages,
    db: DatabasePg,
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

  private async findPromptImages(
    questionIds: UUIDType[],
    db: DatabasePg,
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

  private async createAssessmentForLesson(
    data: QuizLessonCreateData["assessment"] & { lessonId: UUIDType },
    trx: DatabasePg,
  ) {
    const [assessment] = await trx.insert(assessments).values(data).returning();

    return assessment;
  }

  private async insertAssessmentQuestions(
    assessmentId: UUIDType,
    questions: QuizAuthoringQuestion[],
    language: SupportedLanguages,
    trx: DatabasePg,
  ) {
    const questionRows = questions.map((question) => ({
      id: question.id,
      assessmentId,
      questionType: question.questionType,
      displayOrder: question.displayOrder,
      maximumPoints: question.maximumPoints,
      gradingMode: question.gradingMode,
      prompt: buildJsonbField(language, question.prompt),
      title: buildJsonbField(language, question.title),
      description:
        question.description == null ? null : buildJsonbField(language, question.description),
    }));

    const choiceRows = questions.flatMap((question) =>
      question.options.map((option) => ({
        ...option,
        language,
        label: buildJsonbField(language, option.label),
        questionId: question.id,
      })),
    );

    const trueFalseRows = questions.flatMap((question) =>
      question.trueFalseStatements.map((statement) => ({
        ...statement,
        language,
        statement: buildJsonbField(language, statement.statement),
        questionId: question.id,
      })),
    );

    const scaleRows = questions.flatMap((question) =>
      question.scaleOptions.map((option) => ({
        ...option,
        label: buildJsonbField(language, option.label),
        questionId: question.id,
      })),
    );

    const openTextRows = questions.flatMap((question) =>
      question.openTextSettings ? [{ ...question.openTextSettings, questionId: question.id }] : [],
    );

    const blankRows = questions.flatMap((question) =>
      question.blanks.map((blank) => ({
        id: blank.id,
        questionId: question.id,
        textComparisonMode: blank.textComparisonMode,
      })),
    );

    const answerSetRows = questions.flatMap((question) =>
      question.blanks.flatMap((blank) =>
        blank.answerSets.map((answerSet) => ({ ...answerSet, language, blankId: blank.id })),
      ),
    );

    const dragAndDropRows = questions.flatMap((question) =>
      question.dragAndDropOptions.map((option) => ({
        ...option,
        language,
        label: buildJsonbField(language, option.label),
        questionId: question.id,
      })),
    );

    if (questionRows.length) await trx.insert(assessmentQuestions).values(questionRows);
    if (choiceRows.length) await trx.insert(assessmentQuestionChoiceOptions).values(choiceRows);
    if (trueFalseRows.length)
      await trx.insert(assessmentQuestionTrueFalseStatements).values(trueFalseRows);
    if (scaleRows.length) await trx.insert(assessmentQuestionScaleOptions).values(scaleRows);
    if (openTextRows.length)
      await trx.insert(assessmentQuestionOpenTextSettings).values(openTextRows);
    if (blankRows.length) await trx.insert(assessmentQuestionBlanks).values(blankRows);
    if (answerSetRows.length)
      await trx.insert(assessmentQuestionBlankAnswerSets).values(answerSetRows);
    if (dragAndDropRows.length)
      await trx.insert(assessmentQuestionDragAndDropOptions).values(dragAndDropRows);

    await this.clearPromptImageRelations(questions, trx);
  }

  private async syncAssessmentQuestions(
    assessmentId: UUIDType,
    questions: QuizAuthoringQuestion[],
    language: SupportedLanguages,
    trx: DatabasePg,
  ) {
    const existingQuestions = await trx
      .select({ id: assessmentQuestions.id })
      .from(assessmentQuestions)
      .where(eq(assessmentQuestions.assessmentId, assessmentId));

    const existingIds = new Set(existingQuestions.map(({ id }) => id));
    const incomingIds = new Set(questions.map(({ id }) => id));
    const removedIds = existingQuestions
      .map(({ id }) => id)
      .filter((questionId) => !incomingIds.has(questionId));

    if (removedIds.length) {
      await trx
        .delete(resourceEntity)
        .where(
          and(
            inArray(resourceEntity.entityId, removedIds),
            eq(resourceEntity.entityType, ENTITY_TYPES.ASSESSMENT_QUESTION),
          ),
        );
      await trx.delete(assessmentQuestions).where(inArray(assessmentQuestions.id, removedIds));
    }

    const newQuestions = questions.filter((question) => !existingIds.has(question.id));
    const existingQuestionUpdates = questions.filter((question) => existingIds.has(question.id));

    for (const question of existingQuestionUpdates) {
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

    if (newQuestions.length)
      await this.insertAssessmentQuestions(assessmentId, newQuestions, language, trx);
    if (existingQuestionUpdates.length) {
      await this.replaceQuestionConfiguration(existingQuestionUpdates, language, trx);
    }
  }

  private async replaceQuestionConfiguration(
    questions: QuizAuthoringQuestion[],
    language: SupportedLanguages,
    trx: DatabasePg,
  ) {
    const questionIds = questions.map(({ id }) => id);

    const choiceRows = questions.flatMap((question) =>
      question.options.map((option) => ({ ...option, language, questionId: question.id })),
    );
    const trueFalseRows = questions.flatMap((question) =>
      question.trueFalseStatements.map((statement) => ({
        ...statement,
        language,
        questionId: question.id,
      })),
    );
    const dragRows = questions.flatMap((question) =>
      question.dragAndDropOptions.map((option) => ({
        ...option,
        language,
        questionId: question.id,
      })),
    );

    const [existingChoices, existingTrueFalseStatements, existingDragOptions] = await Promise.all([
      trx
        .select()
        .from(assessmentQuestionChoiceOptions)
        .where(
          and(
            inArray(assessmentQuestionChoiceOptions.questionId, questionIds),
            eq(assessmentQuestionChoiceOptions.language, language),
          ),
        ),
      trx
        .select()
        .from(assessmentQuestionTrueFalseStatements)
        .where(
          and(
            inArray(assessmentQuestionTrueFalseStatements.questionId, questionIds),
            eq(assessmentQuestionTrueFalseStatements.language, language),
          ),
        ),
      trx
        .select()
        .from(assessmentQuestionDragAndDropOptions)
        .where(
          and(
            inArray(assessmentQuestionDragAndDropOptions.questionId, questionIds),
            eq(assessmentQuestionDragAndDropOptions.language, language),
          ),
        ),
    ]);

    const choiceChanges = mapLocalizedQuestionChildChanges(existingChoices, choiceRows);
    const trueFalseChanges = mapLocalizedQuestionChildChanges(
      existingTrueFalseStatements,
      trueFalseRows,
    );
    const dragChanges = mapLocalizedQuestionChildChanges(existingDragOptions, dragRows);

    await trx.delete(assessmentQuestionChoiceOptions).where(
      and(
        inArray(assessmentQuestionChoiceOptions.questionId, questionIds),
        inArray(
          assessmentQuestionChoiceOptions.id,
          choiceChanges.rowsToDelete.map(({ id }) => id),
        ),
      ),
    );

    await trx.delete(assessmentQuestionTrueFalseStatements).where(
      and(
        inArray(assessmentQuestionTrueFalseStatements.questionId, questionIds),
        inArray(
          assessmentQuestionTrueFalseStatements.id,
          trueFalseChanges.rowsToDelete.map(({ id }) => id),
        ),
      ),
    );

    await trx
      .delete(assessmentQuestionOpenTextSettings)
      .where(inArray(assessmentQuestionOpenTextSettings.questionId, questionIds));

    await trx.delete(assessmentQuestionDragAndDropOptions).where(
      and(
        inArray(assessmentQuestionDragAndDropOptions.questionId, questionIds),
        inArray(
          assessmentQuestionDragAndDropOptions.id,
          dragChanges.rowsToDelete.map(({ id }) => id),
        ),
      ),
    );

    const openTextRows = questions.flatMap((question) =>
      question.openTextSettings ? [{ ...question.openTextSettings, questionId: question.id }] : [],
    );

    if (choiceChanges.rowsToCreate.length)
      await trx.insert(assessmentQuestionChoiceOptions).values(
        choiceChanges.rowsToCreate.map((option) => ({
          ...option,
          label: buildJsonbField(language, option.label),
        })),
      );

    if (trueFalseChanges.rowsToCreate.length) {
      await trx.insert(assessmentQuestionTrueFalseStatements).values(
        trueFalseChanges.rowsToCreate.map((statement) => ({
          ...statement,
          statement: buildJsonbField(language, statement.statement),
        })),
      );
    }

    if (openTextRows.length)
      await trx.insert(assessmentQuestionOpenTextSettings).values(openTextRows);

    if (dragChanges.rowsToCreate.length)
      await trx.insert(assessmentQuestionDragAndDropOptions).values(
        dragChanges.rowsToCreate.map((option) => ({
          ...option,
          label: buildJsonbField(language, option.label),
        })),
      );

    for (const option of choiceChanges.rowsToUpdate) {
      await trx
        .update(assessmentQuestionChoiceOptions)
        .set({
          displayOrder: option.displayOrder,
          isCorrect: option.isCorrect,
          label: setJsonbField(
            assessmentQuestionChoiceOptions.label,
            language,
            option.label,
            true,
            true,
          ),
        })
        .where(eq(assessmentQuestionChoiceOptions.id, option.id));
    }

    for (const statement of trueFalseChanges.rowsToUpdate) {
      await trx
        .update(assessmentQuestionTrueFalseStatements)
        .set({
          displayOrder: statement.displayOrder,
          correctValue: statement.correctValue,
          statement: setJsonbField(
            assessmentQuestionTrueFalseStatements.statement,
            language,
            statement.statement,
            true,
            true,
          ),
        })
        .where(eq(assessmentQuestionTrueFalseStatements.id, statement.id));
    }

    for (const option of dragChanges.rowsToUpdate) {
      await trx
        .update(assessmentQuestionDragAndDropOptions)
        .set({
          displayOrder: option.displayOrder,
          label: setJsonbField(
            assessmentQuestionDragAndDropOptions.label,
            language,
            option.label,
            true,
            true,
          ),
          targetBlankId: option.targetBlankId,
        })
        .where(eq(assessmentQuestionDragAndDropOptions.id, option.id));
    }

    await this.syncScaleOptions(questions, language, trx);
    await this.syncBlanksAndAnswerSets(questions, language, trx);

    await this.clearPromptImageRelations(questions, trx);
  }

  private async syncScaleOptions(
    questions: QuizAuthoringQuestion[],
    language: SupportedLanguages,
    trx: DatabasePg,
  ) {
    const existing = await trx
      .select()
      .from(assessmentQuestionScaleOptions)
      .where(
        inArray(
          assessmentQuestionScaleOptions.questionId,
          questions.map(({ id }) => id),
        ),
      );

    const { optionsToCreate, optionsToUpdate, optionsToDelete } = mapScaleOptionChanges(
      existing,
      questions,
    );

    if (optionsToDelete.length) {
      await trx.delete(assessmentQuestionScaleOptions).where(
        inArray(
          assessmentQuestionScaleOptions.id,
          optionsToDelete.map(({ id }) => id),
        ),
      );
    }

    if (optionsToCreate.length) {
      await trx.insert(assessmentQuestionScaleOptions).values(
        optionsToCreate.map((option) => ({
          ...option,
          label: buildJsonbField(language, option.label),
        })),
      );
    }

    for (const option of optionsToUpdate) {
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
  }

  private async syncBlanksAndAnswerSets(
    questions: QuizAuthoringQuestion[],
    language: SupportedLanguages,
    trx: DatabasePg,
  ) {
    const questionIds = questions.map(({ id }) => id);

    const existing = await trx
      .select()
      .from(assessmentQuestionBlanks)
      .where(inArray(assessmentQuestionBlanks.questionId, questionIds));

    const { blanksToCreate, blanksToUpdate, blanksToDelete, blankIdsToSync, answerSetsToCreate } =
      mapBlankChanges(existing, questions);

    if (blanksToDelete.length) {
      await trx.delete(assessmentQuestionBlanks).where(
        inArray(
          assessmentQuestionBlanks.id,
          blanksToDelete.map(({ id }) => id),
        ),
      );
    }

    if (blanksToCreate.length) {
      await trx.insert(assessmentQuestionBlanks).values(blanksToCreate);
    }

    for (const blank of blanksToUpdate) {
      await trx
        .update(assessmentQuestionBlanks)
        .set({ textComparisonMode: blank.textComparisonMode })
        .where(eq(assessmentQuestionBlanks.id, blank.id));
    }

    if (blankIdsToSync.length) {
      await trx
        .delete(assessmentQuestionBlankAnswerSets)
        .where(
          and(
            inArray(assessmentQuestionBlankAnswerSets.blankId, blankIdsToSync),
            eq(assessmentQuestionBlankAnswerSets.language, language),
          ),
        );
    }

    if (answerSetsToCreate.length)
      await trx
        .insert(assessmentQuestionBlankAnswerSets)
        .values(answerSetsToCreate.map((answerSet) => ({ ...answerSet, language })));
  }

  private async clearPromptImageRelations(questions: QuizAuthoringQuestion[], trx: DatabasePg) {
    const questionIds = questions.map(({ id }) => id);

    if (!questionIds.length) return;

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
