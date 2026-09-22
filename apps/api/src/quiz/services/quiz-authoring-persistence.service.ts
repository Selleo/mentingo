import { Injectable } from "@nestjs/common";

import {
  mapBlankChanges,
  mapLocalizedQuestionChildChanges,
  mapScaleOptionChanges,
} from "../mappers/legacy-to-quiz-authoring.mapper";
import { QuizAuthoringRepository } from "../repositories/quiz-authoring.repository";

import type {
  QuizAuthoringQuestion,
  QuizLessonCreateData,
  QuizLessonUpdateData,
} from "../types/quiz-authoring.types";
import type { SupportedLanguages } from "@repo/shared";
import type { DatabasePg, UUIDType } from "src/common";

@Injectable()
export class QuizAuthoringPersistenceService {
  constructor(private readonly quizAuthoringRepository: QuizAuthoringRepository) {}

  async createQuizLesson(data: QuizLessonCreateData, db?: DatabasePg) {
    return this.quizAuthoringRepository.withTransaction(async (trx) => {
      const lesson = await this.quizAuthoringRepository.insertLesson(
        data.lesson,
        data.language,
        trx,
      );

      const assessment = await this.quizAuthoringRepository.insertAssessment(
        { ...data.assessment, lessonId: lesson.id },
        trx,
      );

      await this.insertAssessmentQuestions(assessment.id, data.questions, data.language, trx);

      return lesson;
    }, db);
  }

  async updateQuizLesson(
    { lesson, lessonId, assessment: assessmentData, questions }: QuizLessonUpdateData,
    db?: DatabasePg,
  ) {
    return this.quizAuthoringRepository.withTransaction(async (trx) => {
      await this.quizAuthoringRepository.updateLesson(lessonId, lesson, trx);
      const assessment = Object.values(assessmentData).some((value) => value !== undefined)
        ? await this.quizAuthoringRepository.updateAssessment(lessonId, assessmentData, trx)
        : await this.quizAuthoringRepository.findAssessmentByLessonId(lessonId, trx);

      if (!assessment) return null;

      if (questions)
        await this.syncAssessmentQuestions(assessment.id, questions, lesson.language, trx);

      return assessment;
    }, db);
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
      prompt: question.prompt,
      title: question.title,
      description: question.description,
    }));

    const choiceRows = questions.flatMap((question) =>
      question.options.map((option) => ({
        ...option,
        language,
        questionId: question.id,
      })),
    );

    const trueFalseRows = questions.flatMap((question) =>
      question.trueFalseStatements.map((statement) => ({
        ...statement,
        language,
        questionId: question.id,
      })),
    );

    const scaleRows = questions.flatMap((question) =>
      question.scaleOptions.map((option) => ({
        ...option,
        label: option.label,
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
        questionId: question.id,
      })),
    );

    if (questionRows.length)
      await this.quizAuthoringRepository.insertQuestions(questionRows, language, trx);
    if (choiceRows.length) await this.quizAuthoringRepository.insertChoiceOptions(choiceRows, trx);
    if (trueFalseRows.length)
      await this.quizAuthoringRepository.insertTrueFalseStatements(trueFalseRows, trx);
    if (scaleRows.length)
      await this.quizAuthoringRepository.insertScaleOptions(scaleRows, language, trx);
    if (openTextRows.length)
      await this.quizAuthoringRepository.insertOpenTextSettings(openTextRows, trx);
    if (blankRows.length) await this.quizAuthoringRepository.insertBlanks(blankRows, trx);
    if (answerSetRows.length)
      await this.quizAuthoringRepository.insertBlankAnswerSets(answerSetRows, trx);
    if (dragAndDropRows.length)
      await this.quizAuthoringRepository.insertDragAndDropOptions(dragAndDropRows, trx);

    await this.clearPromptImageRelations(questions, trx);
  }

  private async syncAssessmentQuestions(
    assessmentId: UUIDType,
    questions: QuizAuthoringQuestion[],
    language: SupportedLanguages,
    trx: DatabasePg,
  ) {
    const existingQuestions = await this.quizAuthoringRepository.findQuestionIds(assessmentId, trx);

    const existingIds = new Set(existingQuestions.map(({ id }) => id));
    const incomingIds = new Set(questions.map(({ id }) => id));
    const removedIds = existingQuestions
      .map(({ id }) => id)
      .filter((questionId) => !incomingIds.has(questionId));

    if (removedIds.length) {
      await this.quizAuthoringRepository.deleteQuestionResources(removedIds, trx);
      await this.quizAuthoringRepository.deleteQuestions(removedIds, trx);
    }

    const newQuestions = questions.filter((question) => !existingIds.has(question.id));
    const existingQuestionUpdates = questions.filter((question) => existingIds.has(question.id));

    for (const question of existingQuestionUpdates) {
      await this.quizAuthoringRepository.updateQuestion(question, language, trx);
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
      this.quizAuthoringRepository.findChoiceOptions(questionIds, language, trx),
      this.quizAuthoringRepository.findTrueFalseStatements(questionIds, language, trx),
      this.quizAuthoringRepository.findDragAndDropOptions(questionIds, language, trx),
    ]);

    const choiceChanges = mapLocalizedQuestionChildChanges(existingChoices, choiceRows);
    const trueFalseChanges = mapLocalizedQuestionChildChanges(
      existingTrueFalseStatements,
      trueFalseRows,
    );
    const dragChanges = mapLocalizedQuestionChildChanges(existingDragOptions, dragRows);

    if (choiceChanges.rowsToDelete.length)
      await this.quizAuthoringRepository.deleteChoiceOptions(
        questionIds,
        choiceChanges.rowsToDelete.map(({ id }) => id),
        trx,
      );

    if (trueFalseChanges.rowsToDelete.length)
      await this.quizAuthoringRepository.deleteTrueFalseStatements(
        questionIds,
        trueFalseChanges.rowsToDelete.map(({ id }) => id),
        trx,
      );

    await this.quizAuthoringRepository.deleteOpenTextSettings(questionIds, trx);

    if (dragChanges.rowsToDelete.length)
      await this.quizAuthoringRepository.deleteDragAndDropOptions(
        questionIds,
        dragChanges.rowsToDelete.map(({ id }) => id),
        trx,
      );

    for (const [temporaryIndex, option] of dragChanges.rowsToUpdate.entries()) {
      await this.quizAuthoringRepository.updateDragAndDropOption(
        option.id,
        {
          targetBlankId: null,
          displayOrder: -(temporaryIndex + 1),
        },
        trx,
      );
    }

    await this.syncBlanksAndAnswerSets(questions, language, trx);

    const openTextRows = questions.flatMap((question) =>
      question.openTextSettings ? [{ ...question.openTextSettings, questionId: question.id }] : [],
    );

    if (choiceChanges.rowsToCreate.length)
      await this.quizAuthoringRepository.insertChoiceOptions(choiceChanges.rowsToCreate, trx);

    if (trueFalseChanges.rowsToCreate.length) {
      await this.quizAuthoringRepository.insertTrueFalseStatements(
        trueFalseChanges.rowsToCreate,
        trx,
      );
    }

    if (openTextRows.length)
      await this.quizAuthoringRepository.insertOpenTextSettings(openTextRows, trx);

    if (dragChanges.rowsToCreate.length)
      await this.quizAuthoringRepository.insertDragAndDropOptions(dragChanges.rowsToCreate, trx);

    for (const option of choiceChanges.rowsToUpdate) {
      await this.quizAuthoringRepository.updateChoiceOption(
        option.id,
        {
          displayOrder: option.displayOrder,
          isCorrect: option.isCorrect,
          label: option.label,
        },
        trx,
      );
    }

    for (const statement of trueFalseChanges.rowsToUpdate) {
      await this.quizAuthoringRepository.updateTrueFalseStatement(
        statement.id,
        {
          displayOrder: statement.displayOrder,
          correctValue: statement.correctValue,
          statement: statement.statement,
        },
        trx,
      );
    }

    for (const option of dragChanges.rowsToUpdate) {
      await this.quizAuthoringRepository.updateDragAndDropOption(
        option.id,
        {
          displayOrder: option.displayOrder,
          label: option.label,
          targetBlankId: option.targetBlankId,
        },
        trx,
      );
    }

    await this.syncScaleOptions(questions, language, trx);

    await this.clearPromptImageRelations(questions, trx);
  }

  private async syncScaleOptions(
    questions: QuizAuthoringQuestion[],
    language: SupportedLanguages,
    trx: DatabasePg,
  ) {
    const existing = await this.quizAuthoringRepository.findScaleOptionRows(
      questions.map(({ id }) => id),
      trx,
    );

    const { optionsToCreate, optionsToUpdate, optionsToDelete } = mapScaleOptionChanges(
      existing,
      questions,
    );

    if (optionsToDelete.length) {
      await this.quizAuthoringRepository.deleteScaleOptions(
        optionsToDelete.map(({ id }) => id),
        trx,
      );
    }

    if (optionsToCreate.length) {
      await this.quizAuthoringRepository.insertScaleOptions(optionsToCreate, language, trx);
    }

    for (const option of optionsToUpdate) {
      await this.quizAuthoringRepository.updateScaleOption(option, language, trx);
    }
  }

  private async syncBlanksAndAnswerSets(
    questions: QuizAuthoringQuestion[],
    language: SupportedLanguages,
    trx: DatabasePg,
  ) {
    const questionIds = questions.map(({ id }) => id);

    const existing = await this.quizAuthoringRepository.findBlanks(questionIds, trx);

    const { blanksToCreate, blanksToUpdate, blanksToDelete, blankIdsToSync, answerSetsToCreate } =
      mapBlankChanges(existing, questions);

    if (blanksToDelete.length) {
      await this.quizAuthoringRepository.deleteBlanks(
        blanksToDelete.map(({ id }) => id),
        trx,
      );
    }

    if (blanksToCreate.length) {
      await this.quizAuthoringRepository.insertBlanks(blanksToCreate, trx);
    }

    for (const blank of blanksToUpdate) {
      await this.quizAuthoringRepository.updateBlank(
        blank.id,
        { textComparisonMode: blank.textComparisonMode },
        trx,
      );
    }

    if (blankIdsToSync.length) {
      await this.quizAuthoringRepository.deleteBlankAnswerSets(blankIdsToSync, language, trx);
    }

    if (answerSetsToCreate.length)
      await this.quizAuthoringRepository.insertBlankAnswerSets(
        answerSetsToCreate.map((answerSet) => ({ ...answerSet, language })),
        trx,
      );
  }

  private async clearPromptImageRelations(questions: QuizAuthoringQuestion[], trx: DatabasePg) {
    const questionIds = questions.map(({ id }) => id);

    if (!questionIds.length) return;

    await this.quizAuthoringRepository.clearPromptImageRelations(questionIds, trx);
  }
}
