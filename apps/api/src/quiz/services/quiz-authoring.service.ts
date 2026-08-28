import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  ASSESSMENT_ATTEMPT_LIMIT_MODES,
  ENTITY_TYPES,
  LESSON_TYPES,
  type SupportedLanguages,
} from "@repo/shared";
import { lookup } from "mime-types";

import { RESOURCE_RELATIONSHIP_TYPES } from "src/file/file.constants";
import { FileService } from "src/file/file.service";
import { MAX_LESSON_TITLE_LENGTH } from "src/lesson/repositories/lesson.constants";
import { LocalizationService } from "src/localization/localization.service";
import { ENTITY_TYPE } from "src/localization/localization.types";
import { QUESTION_TYPE } from "src/questions/schema/question.types";

import { mapLegacyQuizAuthoringInput } from "../mappers/legacy-to-quiz-authoring.mapper";
import { mapLocalizedQuizAuthoringReadModelToLegacy } from "../mappers/quiz-authoring-to-legacy.mapper";
import { QuizAuthoringRepository } from "../repositories/quiz-authoring.repository";

import type {
  QuizAuthoringInput,
  QuizAuthoringQuestion,
  QuizAuthoringLocalizedReadModel,
  QuizLessonCreateData,
} from "../types/quiz-authoring.types";
import type { UUIDType } from "src/common";
import type {
  AdminLessonWithContentSchema,
  CreateQuizLessonBody,
  UpdateQuizLessonBody,
} from "src/lesson/lesson.schema";

type QuizAuthoringRows = NonNullable<
  Awaited<ReturnType<QuizAuthoringRepository["getQuizLessonForAuthoring"]>>
>;

@Injectable()
export class QuizAuthoringService {
  constructor(
    private readonly quizAuthoringRepository: QuizAuthoringRepository,
    private readonly localizationService: LocalizationService,
    private readonly fileService: FileService,
  ) {}

  async createQuizLesson(input: CreateQuizLessonBody) {
    this.validateQuestionTypes(input.questions);
    const { language } = await this.localizationService.getBaseLanguage(
      ENTITY_TYPE.CHAPTER,
      input.chapterId,
    );
    const quizAuthoringInput = mapLegacyQuizAuthoringInput(input, undefined, language);

    this.validateQuizAuthoringInput(quizAuthoringInput, {
      requireChapterId: true,
      requireQuestions: true,
    });

    if (!quizAuthoringInput.chapterId)
      throw new BadRequestException("adminCourseView.errors.lesson.quizCreateFailed");

    const lesson = {
      chapterId: quizAuthoringInput.chapterId,
      type: LESSON_TYPES.QUIZ,
      title: quizAuthoringInput.title,
      description: quizAuthoringInput.description ?? null,
      thresholdScore: quizAuthoringInput.thresholdScore,
      attemptsLimit: quizAuthoringInput.attemptsLimit,
      quizCooldownInHours: quizAuthoringInput.quizCooldownInHours,
      displayOrder: quizAuthoringInput.displayOrder,
    };

    const createdLesson = await this.quizAuthoringRepository.createQuizLesson({
      language: quizAuthoringInput.language,
      lesson,
      assessment: this.toAssessmentData(quizAuthoringInput),
      questions: quizAuthoringInput.questions ?? [],
    });
    await this.createPromptImageResources(quizAuthoringInput.questions ?? []);

    return createdLesson;
  }

  async updateQuizLesson(lessonId: UUIDType, input: UpdateQuizLessonBody) {
    this.validateQuestionTypes(input.questions);

    const quizAuthoringInput = mapLegacyQuizAuthoringInput(input, lessonId);
    this.validateQuizAuthoringInput(quizAuthoringInput, {
      requireChapterId: false,
      requireQuestions: false,
    });

    if (input.quizCooldownInHours !== undefined && input.attemptsLimit === undefined)
      throw new BadRequestException("adminCourseView.errors.lesson.quizCreateFailed");

    const attemptLimitUpdate = this.getAttemptLimitUpdate(input);

    const data = {
      lessonId,
      lesson: {
        language: quizAuthoringInput.language,
        ...(input.title === undefined ? {} : { title: input.title }),
        ...(input.description === undefined ? {} : { description: input.description }),
        ...(input.thresholdScore === undefined ? {} : { thresholdScore: input.thresholdScore }),
        ...this.getLessonAttemptLimitUpdate(input),
        ...(input.quizCooldownInHours === undefined || input.attemptsLimit === null
          ? {}
          : { quizCooldownInHours: input.quizCooldownInHours }),
      },
      assessment: {
        ...(input.thresholdScore === undefined
          ? {}
          : { passingScorePercentage: String(input.thresholdScore) }),
        ...attemptLimitUpdate,
      },
      ...(input.questions === undefined ? {} : { questions: quizAuthoringInput.questions ?? [] }),
    };

    const lesson = await this.quizAuthoringRepository.updateQuizLesson(data);
    if (!lesson) throw new NotFoundException("adminCourseView.errors.notFound.lesson");
    await this.createPromptImageResources(quizAuthoringInput.questions ?? []);

    return lesson;
  }

  private async createPromptImageResources(questions: QuizAuthoringQuestion[]) {
    for (const question of questions.filter(({ photoS3Key }) => photoS3Key)) {
      const reference = question.photoS3Key;

      if (!reference) continue;

      await this.fileService.createResourceForEntity({
        reference,
        contentType: lookup(reference) || "application/octet-stream",
        entityId: question.id,
        entityType: ENTITY_TYPES.ASSESSMENT_QUESTION,
        relationshipType: RESOURCE_RELATIONSHIP_TYPES.PROMPT_IMAGE,
        reuseExisting: true,
      });
    }
  }

  async getQuizLessonForAuthoring(
    lessonId: UUIDType,
    requestedLanguage?: SupportedLanguages,
  ): Promise<QuizAuthoringLocalizedReadModel | null> {
    const { language } = await this.localizationService.getBaseLanguage(
      ENTITY_TYPE.LESSON,
      lessonId,
      requestedLanguage,
    );
    const rows = await this.quizAuthoringRepository.getQuizLessonForAuthoring(lessonId, language);
    if (!rows) return null;

    return this.mapQuizAuthoringRows(rows);
  }

  async getLegacyQuizLessonForAuthoring(
    lessonId: UUIDType,
    language?: SupportedLanguages,
  ): Promise<AdminLessonWithContentSchema | null> {
    const { language: resolvedLanguage } = await this.localizationService.getBaseLanguage(
      ENTITY_TYPE.LESSON,
      lessonId,
      language,
    );
    const authoringModel = await this.getQuizLessonForAuthoring(lessonId, resolvedLanguage);
    if (!authoringModel) return null;

    return mapLocalizedQuizAuthoringReadModelToLegacy(authoringModel);
  }

  private mapQuizAuthoringRows(rows: QuizAuthoringRows): QuizAuthoringLocalizedReadModel {
    const { lesson, assessment, questions } = rows;

    const byQuestion = <T extends { questionId: string }>(items: T[], questionId: string) =>
      items.filter((item) => item.questionId === questionId);

    return {
      lesson,
      assessment: {
        id: assessment.id,
        passingScorePercentage: assessment.passingScorePercentage,
        attemptLimitMode: assessment.attemptLimitMode,
        maximumAttempts: assessment.maximumAttempts,
        attemptCooldown: assessment.attemptCooldown,
        baseLanguage: assessment.baseLanguage,
        availableLocales: assessment.availableLocales,
      },
      questions: questions.map((question) => ({
        id: question.id,
        questionType: question.questionType,
        displayOrder: question.displayOrder,
        maximumPoints: question.maximumPoints,
        gradingMode: question.gradingMode,
        prompt: question.prompt,
        title: question.title,
        description: question.description || null,
        photoS3Key:
          rows.promptImages.find((image) => image.questionId === question.id)?.reference ?? null,
        options: byQuestion(rows.choiceOptions, question.id).map((option) => ({
          id: option.id,
          displayOrder: option.displayOrder,
          isCorrect: option.isCorrect,
          label: option.label,
        })),
        trueFalseStatements: byQuestion(rows.trueFalseStatements, question.id).map((statement) => ({
          id: statement.id,
          displayOrder: statement.displayOrder,
          correctValue: statement.correctValue,
          statement: statement.statement,
        })),
        scaleOptions: byQuestion(rows.scaleOptions, question.id).map((option) => ({
          id: option.id,
          displayOrder: option.displayOrder,
          scaleValue: option.scaleValue,
          label: option.label,
        })),
        openTextSettings:
          rows.openTextSettings.find((settings) => settings.questionId === question.id) ?? null,
        blanks: byQuestion(rows.blanks, question.id).map((blank) => ({
          id: blank.id,
          textComparisonMode: blank.textComparisonMode,
          answerSets: rows.answerSets
            .filter((answerSet) => answerSet.blankId === blank.id)
            .map((answerSet) => ({
              preferredAnswer: answerSet.preferredAnswer,
              acceptedAnswers: answerSet.acceptedAnswers,
            })),
        })),
        dragAndDropOptions: byQuestion(rows.dragOptions, question.id).map((option) => ({
          id: option.id,
          label: option.label,
          targetBlankId: option.targetBlankId,
          displayOrder: option.displayOrder,
        })),
      })),
    };
  }

  private validateQuizAuthoringInput(
    input: QuizAuthoringInput,
    options: { requireChapterId: boolean; requireQuestions: boolean },
  ) {
    if (options.requireChapterId && !input.chapterId)
      throw new BadRequestException("adminCourseView.errors.lesson.quizCreateFailed");
    if (options.requireQuestions && !input.questions?.length)
      throw new BadRequestException("adminCourseView.errors.lesson.questionsRequired");
    if (input.title.length > MAX_LESSON_TITLE_LENGTH)
      throw new BadRequestException("adminCourseView.errors.lesson.quizCreateFailed");
    if (input.thresholdScore < 0 || input.thresholdScore > 100)
      throw new BadRequestException("adminCourseView.errors.lesson.quizCreateFailed");
    if (input.attemptsLimit !== null && input.attemptsLimit < 1)
      throw new BadRequestException("adminCourseView.errors.lesson.quizCreateFailed");
    if (input.quizCooldownInHours !== null && input.quizCooldownInHours <= 0)
      throw new BadRequestException("adminCourseView.errors.lesson.quizCreateFailed");
  }

  private validateQuestionTypes(
    questions: CreateQuizLessonBody["questions"] | UpdateQuizLessonBody["questions"],
  ) {
    if (questions?.some((question) => question.type === QUESTION_TYPE.MATCH_WORDS))
      throw new BadRequestException("adminCourseView.errors.lesson.quizCreateFailed");
  }

  private toAssessmentData(input: QuizAuthoringInput): QuizLessonCreateData["assessment"] {
    return {
      passingScorePercentage: String(input.thresholdScore),
      attemptLimitMode:
        input.attemptsLimit === null
          ? ASSESSMENT_ATTEMPT_LIMIT_MODES.NONE
          : ASSESSMENT_ATTEMPT_LIMIT_MODES.LIFETIME,
      maximumAttempts: input.attemptsLimit,
      attemptCooldown:
        input.attemptsLimit === null || input.quizCooldownInHours === null
          ? null
          : `${input.quizCooldownInHours} hours`,
      baseLanguage: input.language,
      availableLocales: [input.language],
    };
  }

  private getAttemptLimitUpdate(input: UpdateQuizLessonBody) {
    if (input.attemptsLimit === undefined) return {};

    const update = {
      attemptLimitMode:
        input.attemptsLimit === null
          ? ASSESSMENT_ATTEMPT_LIMIT_MODES.NONE
          : ASSESSMENT_ATTEMPT_LIMIT_MODES.LIFETIME,
      maximumAttempts: input.attemptsLimit,
    };

    if (input.attemptsLimit === null || input.quizCooldownInHours === null)
      return { ...update, attemptCooldown: null };

    if (input.quizCooldownInHours !== undefined)
      return { ...update, attemptCooldown: `${input.quizCooldownInHours} hours` };

    return update;
  }

  private getLessonAttemptLimitUpdate(input: UpdateQuizLessonBody) {
    if (input.attemptsLimit === undefined) return {};
    if (input.attemptsLimit === null) return { attemptsLimit: null, quizCooldownInHours: null };
    return { attemptsLimit: input.attemptsLimit };
  }
}
