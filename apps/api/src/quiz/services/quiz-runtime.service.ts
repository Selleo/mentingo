import { randomUUID } from "node:crypto";

import { BadRequestException, Injectable } from "@nestjs/common";
import {
  ASSESSMENT_ANSWER_GRADING_STATUSES,
  ASSESSMENT_ATTEMPT_GRADING_STATUSES,
  ASSESSMENT_ATTEMPT_RESULTS,
  ASSESSMENT_QUESTION_TYPES,
  ASSESSMENT_TEXT_COMPARISON_MODES,
  type SupportedLanguages,
} from "@repo/shared";
import { match } from "ts-pattern";
import { validate as uuidValidate } from "uuid";

import { mapQuizAttemptToRuntimeSubmissionResult } from "../mappers/quiz-runtime.mapper";
import { QuizRuntimeRepository } from "../repositories/quiz-runtime.repository";

import { QuizAuthoringService } from "./quiz-authoring.service";

import type {
  QuizAuthoringLocalizedQuestion,
  QuizAuthoringLocalizedReadModel,
} from "../types/quiz-authoring.types";
import type {
  PreparedQuizAttempt,
  QuizDelivery,
  QuizRuntimeSubmissionResult,
  QuizSubmission,
} from "../types/quiz-runtime.types";
import type { UUIDType } from "src/common";
import type { QuestionBody } from "src/lesson/lesson.schema";

@Injectable()
export class QuizRuntimeService {
  constructor(
    private readonly quizAuthoringService: QuizAuthoringService,
    private readonly quizRuntimeRepository: QuizRuntimeRepository,
  ) {}

  async getQuizForDelivery(
    lessonId: UUIDType,
    language?: SupportedLanguages,
  ): Promise<QuizDelivery | null> {
    const quizDefinition = await this.quizAuthoringService.getQuizLessonForAuthoring(
      lessonId,
      language,
    );

    if (!quizDefinition) return null;

    return {
      assessmentId: quizDefinition.assessment.id,
      questions: quizDefinition.questions.map((question) => this.mapQuestionForDelivery(question)),
    };
  }

  async submitQuiz(
    submission: QuizSubmission,
    learnerId: UUIDType,
  ): Promise<QuizRuntimeSubmissionResult> {
    const quizDefinition = await this.quizAuthoringService.getQuizLessonForAuthoring(
      submission.lessonId,
      submission.language,
    );

    if (!quizDefinition)
      throw new BadRequestException("studentLessonView.validation.quizEvaluationFailed");

    const attemptData = this.prepareAttempt(quizDefinition, submission, learnerId);
    const persistedAttempt = await this.quizRuntimeRepository.createSubmittedAttempt(attemptData);

    return mapQuizAttemptToRuntimeSubmissionResult(attemptData, persistedAttempt);
  }

  private mapQuestionForDelivery(question: QuizAuthoringLocalizedQuestion): QuestionBody {
    const deliveryOptions = [
      ...question.options.map((option) =>
        this.mapDeliveryOption(question.id, option.id, option.label, option.displayOrder),
      ),
      ...question.trueFalseStatements.map((statement) =>
        this.mapDeliveryOption(
          question.id,
          statement.id,
          statement.statement,
          statement.displayOrder,
        ),
      ),
      ...question.scaleOptions.map((option) =>
        this.mapDeliveryOption(
          question.id,
          option.id,
          option.label,
          option.displayOrder,
          option.scaleValue,
        ),
      ),
      ...question.dragAndDropOptions.map((option) =>
        this.mapDeliveryOption(question.id, option.id, option.label, option.displayOrder),
      ),
    ];

    return {
      id: question.id,
      type: question.questionType,
      title: question.title,
      description: question.description,
      displayOrder: question.displayOrder,
      solutionExplanation: null,
      photoS3Key: question.photoS3Key,
      options: deliveryOptions,
      passQuestion: null,
    };
  }

  private mapDeliveryOption(
    questionId: UUIDType,
    id: UUIDType,
    optionText: string,
    displayOrder: number,
    scaleAnswer?: number,
  ) {
    return {
      id,
      optionText,
      displayOrder,
      isStudentAnswer: null,
      studentAnswer: null,
      isCorrect: null,
      questionId,
      ...(scaleAnswer === undefined ? {} : { scaleAnswer }),
    };
  }

  private prepareAttempt(
    quizDefinition: QuizAuthoringLocalizedReadModel,
    submission: QuizSubmission,
    learnerId: UUIDType,
  ): PreparedQuizAttempt {
    const questionById = new Map(
      quizDefinition.questions.map((question) => [question.id, question]),
    );
    const submittedQuestionIds = new Set<string>();

    const submittedAt = new Date().toISOString();
    const availablePoints = quizDefinition.questions.reduce(
      (total, question) => total + Number(question.maximumPoints),
      0,
    );

    const attemptData: PreparedQuizAttempt = {
      assessmentId: quizDefinition.assessment.id,
      learnerId,
      language: submission.language,
      availablePoints: availablePoints.toString(),
      awardedPoints: "0",
      scorePercentage: "0",
      gradingStatus: ASSESSMENT_ATTEMPT_GRADING_STATUSES.GRADED,
      result: ASSESSMENT_ATTEMPT_RESULTS.PENDING,
      submittedAt,
      gradedAt: submittedAt,
      questionAnswers: [],
      choiceSelections: [],
      statementAnswers: [],
      blankAnswers: [],
      openTextAnswers: [],
      scaleSelections: [],
    };

    for (const submittedQuestion of submission.questionsAnswers) {
      const quizQuestion = questionById.get(submittedQuestion.questionId);

      if (!quizQuestion || submittedQuestionIds.has(submittedQuestion.questionId))
        throw new BadRequestException("studentLessonView.validation.quizEvaluationFailed");

      submittedQuestionIds.add(submittedQuestion.questionId);

      const questionAnswerId = randomUUID();
      const questionIsCorrect = this.gradeQuestionAnswer(quizQuestion, submittedQuestion.answers);
      const awardedPoints = questionIsCorrect ? Number(quizQuestion.maximumPoints) : 0;

      attemptData.questionAnswers.push({
        id: questionAnswerId,
        questionId: quizQuestion.id,
        gradingStatus: ASSESSMENT_ANSWER_GRADING_STATUSES.GRADED,
        awardedPoints: awardedPoints.toString(),
        submittedAt,
      });

      this.mapSubmittedAnswers(
        attemptData,
        quizQuestion,
        questionAnswerId,
        submittedQuestion.answers,
      );
    }

    if (submittedQuestionIds.size !== quizDefinition.questions.length)
      throw new BadRequestException("studentLessonView.validation.quizEvaluationFailed");

    const awardedPoints = attemptData.questionAnswers.reduce(
      (total, questionAnswer) => total + Number(questionAnswer.awardedPoints),
      0,
    );

    const scorePercentage = availablePoints ? (awardedPoints / availablePoints) * 100 : 0;

    attemptData.awardedPoints = awardedPoints.toString();
    attemptData.scorePercentage = scorePercentage.toFixed(2);
    attemptData.result =
      scorePercentage >= Number(quizDefinition.assessment.passingScorePercentage)
        ? ASSESSMENT_ATTEMPT_RESULTS.PASSED
        : ASSESSMENT_ATTEMPT_RESULTS.FAILED;

    return attemptData;
  }

  private gradeQuestionAnswer(
    quizQuestion: QuizAuthoringLocalizedQuestion,
    answers: QuizSubmission["questionsAnswers"][number]["answers"],
  ): boolean {
    return match(quizQuestion.questionType)
      .with(
        ASSESSMENT_QUESTION_TYPES.SINGLE_CHOICE,
        ASSESSMENT_QUESTION_TYPES.PHOTO_QUESTION_SINGLE_CHOICE,
        ASSESSMENT_QUESTION_TYPES.MULTIPLE_CHOICE,
        ASSESSMENT_QUESTION_TYPES.PHOTO_QUESTION_MULTIPLE_CHOICE,
        () => this.gradeChoiceQuestion(quizQuestion, answers),
      )
      .with(ASSESSMENT_QUESTION_TYPES.TRUE_OR_FALSE, () =>
        this.gradeTrueFalseQuestion(quizQuestion, answers),
      )
      .with(ASSESSMENT_QUESTION_TYPES.SCALE_1_5, () =>
        this.gradeScaleQuestion(quizQuestion, answers),
      )
      .with(ASSESSMENT_QUESTION_TYPES.FILL_IN_THE_BLANKS_TEXT, () =>
        this.gradeTextBlankQuestion(quizQuestion, answers),
      )
      .with(ASSESSMENT_QUESTION_TYPES.FILL_IN_THE_BLANKS_DND, () =>
        this.gradeDragAndDropQuestion(quizQuestion, answers),
      )
      .with(
        ASSESSMENT_QUESTION_TYPES.BRIEF_RESPONSE,
        ASSESSMENT_QUESTION_TYPES.DETAILED_RESPONSE,
        () => true,
      )
      .otherwise(() => false);
  }

  private gradeChoiceQuestion(
    quizQuestion: QuizAuthoringLocalizedQuestion,
    answers: QuizSubmission["questionsAnswers"][number]["answers"],
  ) {
    const selectedOptionIds = answers.flatMap((answer) =>
      "answerId" in answer ? [answer.answerId] : [],
    );

    const correctOptionIds = quizQuestion.options
      .filter((option) => option.isCorrect)
      .map((option) => option.id);

    return (
      selectedOptionIds.length === correctOptionIds.length &&
      correctOptionIds.every((optionId) => selectedOptionIds.includes(optionId))
    );
  }

  private gradeTrueFalseQuestion(
    quizQuestion: QuizAuthoringLocalizedQuestion,
    answers: QuizSubmission["questionsAnswers"][number]["answers"],
  ) {
    return (
      answers.length === quizQuestion.trueFalseStatements.length &&
      quizQuestion.trueFalseStatements.every((statement) => {
        const submittedAnswer = answers.find(
          (answer) => "answerId" in answer && answer.answerId === statement.id,
        );

        if (!submittedAnswer || !("value" in submittedAnswer)) return false;

        return this.parseBoolean(submittedAnswer.value) === statement.correctValue;
      })
    );
  }

  private gradeScaleQuestion(
    quizQuestion: QuizAuthoringLocalizedQuestion,
    answers: QuizSubmission["questionsAnswers"][number]["answers"],
  ) {
    const selectedAnswer = answers[0];

    return (
      answers.length === 1 &&
      selectedAnswer !== undefined &&
      "answerId" in selectedAnswer &&
      quizQuestion.scaleOptions.some((option) => option.id === selectedAnswer.answerId)
    );
  }

  private gradeTextBlankQuestion(
    quizQuestion: QuizAuthoringLocalizedQuestion,
    answers: QuizSubmission["questionsAnswers"][number]["answers"],
  ) {
    return quizQuestion.blanks.every((blank, index) => {
      const submittedAnswer = this.findBlankAnswer(answers, blank.id, index);
      if (!submittedAnswer || !("value" in submittedAnswer)) return false;

      return blank.answerSets.some((answerSet) =>
        answerSet.acceptedAnswers.some((acceptedAnswer) =>
          this.compareTextAnswer(submittedAnswer.value, acceptedAnswer, blank.textComparisonMode),
        ),
      );
    });
  }

  private gradeDragAndDropQuestion(
    quizQuestion: QuizAuthoringLocalizedQuestion,
    answers: QuizSubmission["questionsAnswers"][number]["answers"],
  ) {
    return quizQuestion.blanks.every((blank, index) => {
      const submittedAnswer = this.findBlankAnswer(answers, blank.id, index);

      if (!submittedAnswer || !("value" in submittedAnswer)) return false;

      return quizQuestion.dragAndDropOptions.some(
        (option) => option.id === submittedAnswer.value && option.targetBlankId === blank.id,
      );
    });
  }

  private findBlankAnswer(
    answers: QuizSubmission["questionsAnswers"][number]["answers"],
    blankId: UUIDType,
    blankIndex: number,
  ) {
    return (
      answers.find((answer) => "answerId" in answer && answer.answerId === blankId) ??
      answers[blankIndex]
    );
  }

  private compareTextAnswer(
    submittedAnswer: string,
    acceptedAnswer: string,
    comparisonMode: QuizAuthoringLocalizedQuestion["blanks"][number]["textComparisonMode"],
  ) {
    return match(comparisonMode)
      .with(ASSESSMENT_TEXT_COMPARISON_MODES.EXACT, () => submittedAnswer === acceptedAnswer)
      .with(
        ASSESSMENT_TEXT_COMPARISON_MODES.NORMALIZED,
        () => submittedAnswer.trim().toLowerCase() === acceptedAnswer.trim().toLowerCase(),
      )
      .exhaustive();
  }

  private mapSubmittedAnswers(
    attemptData: PreparedQuizAttempt,
    quizQuestion: QuizAuthoringLocalizedQuestion,
    questionAnswerId: UUIDType,
    answers: QuizSubmission["questionsAnswers"][number]["answers"],
  ) {
    match(quizQuestion.questionType)
      .with(
        ASSESSMENT_QUESTION_TYPES.SINGLE_CHOICE,
        ASSESSMENT_QUESTION_TYPES.MULTIPLE_CHOICE,
        ASSESSMENT_QUESTION_TYPES.PHOTO_QUESTION_SINGLE_CHOICE,
        ASSESSMENT_QUESTION_TYPES.PHOTO_QUESTION_MULTIPLE_CHOICE,
        () => this.mapChoiceAnswers(attemptData, quizQuestion, questionAnswerId, answers),
      )
      .with(ASSESSMENT_QUESTION_TYPES.TRUE_OR_FALSE, () =>
        this.mapTrueFalseAnswers(attemptData, quizQuestion, questionAnswerId, answers),
      )
      .with(ASSESSMENT_QUESTION_TYPES.SCALE_1_5, () =>
        this.mapScaleAnswer(attemptData, quizQuestion, questionAnswerId, answers),
      )
      .with(ASSESSMENT_QUESTION_TYPES.FILL_IN_THE_BLANKS_TEXT, () =>
        this.mapBlankAnswers(attemptData, quizQuestion, questionAnswerId, answers, false),
      )
      .with(ASSESSMENT_QUESTION_TYPES.FILL_IN_THE_BLANKS_DND, () =>
        this.mapBlankAnswers(attemptData, quizQuestion, questionAnswerId, answers, true),
      )
      .with(
        ASSESSMENT_QUESTION_TYPES.BRIEF_RESPONSE,
        ASSESSMENT_QUESTION_TYPES.DETAILED_RESPONSE,
        () => this.mapOpenTextAnswer(attemptData, questionAnswerId, answers),
      )
      .otherwise(() => {
        throw this.invalidSubmission();
      });
  }

  private mapChoiceAnswers(
    attemptData: PreparedQuizAttempt,
    quizQuestion: QuizAuthoringLocalizedQuestion,
    questionAnswerId: UUIDType,
    answers: QuizSubmission["questionsAnswers"][number]["answers"],
  ) {
    for (const answer of answers) {
      if (!("answerId" in answer)) throw this.invalidSubmission();

      this.assertIdBelongsToQuestion(answer.answerId, quizQuestion.options);

      attemptData.choiceSelections.push({ questionAnswerId, selectedOptionId: answer.answerId });
    }
  }

  private mapTrueFalseAnswers(
    attemptData: PreparedQuizAttempt,
    quizQuestion: QuizAuthoringLocalizedQuestion,
    questionAnswerId: UUIDType,
    answers: QuizSubmission["questionsAnswers"][number]["answers"],
  ) {
    for (const answer of answers) {
      if (!("answerId" in answer) || !("value" in answer)) throw this.invalidSubmission();

      const submittedValue = this.parseBoolean(answer.value);
      if (submittedValue === null) throw this.invalidSubmission();

      this.assertIdBelongsToQuestion(answer.answerId, quizQuestion.trueFalseStatements);

      attemptData.statementAnswers.push({
        questionAnswerId,
        statementId: answer.answerId,
        submittedValue,
      });
    }
  }

  private mapScaleAnswer(
    attemptData: PreparedQuizAttempt,
    quizQuestion: QuizAuthoringLocalizedQuestion,
    questionAnswerId: UUIDType,
    answers: QuizSubmission["questionsAnswers"][number]["answers"],
  ) {
    if (answers.length !== 1 || !("answerId" in answers[0])) throw this.invalidSubmission();

    this.assertIdBelongsToQuestion(answers[0].answerId, quizQuestion.scaleOptions);

    attemptData.scaleSelections.push({
      questionAnswerId,
      selectedScaleOptionId: answers[0].answerId,
    });
  }

  private mapBlankAnswers(
    attemptData: PreparedQuizAttempt,
    quizQuestion: QuizAuthoringLocalizedQuestion,
    questionAnswerId: UUIDType,
    answers: QuizSubmission["questionsAnswers"][number]["answers"],
    isDragAndDrop: boolean,
  ) {
    for (const answer of answers) {
      if (!("answerId" in answer) || !("value" in answer)) throw this.invalidSubmission();

      this.assertIdBelongsToQuestion(answer.answerId, quizQuestion.blanks);

      const selectedDragOptionId = isDragAndDrop ? this.assertUuid(answer.value) : null;

      attemptData.blankAnswers.push({
        questionAnswerId,
        blankId: answer.answerId,
        submittedText: selectedDragOptionId ? null : answer.value,
        selectedDragOptionId,
      });
    }
  }

  private mapOpenTextAnswer(
    attemptData: PreparedQuizAttempt,
    questionAnswerId: UUIDType,
    answers: QuizSubmission["questionsAnswers"][number]["answers"],
  ) {
    const [openTextAnswer] = answers;

    if (answers.length !== 1 || !openTextAnswer || !("value" in openTextAnswer))
      throw this.invalidSubmission();

    attemptData.openTextAnswers.push({
      questionAnswerId,
      submittedText: openTextAnswer.value,
    });
  }

  private assertIdBelongsToQuestion(id: UUIDType, rows: Array<{ id: UUIDType }>) {
    if (!rows.some((row) => row.id === id)) throw this.invalidSubmission();
  }

  // Required due to old contract data type
  private parseBoolean(value: string) {
    if (value === "true") return true;
    if (value === "false") return false;
    return null;
  }

  private assertUuid(value: string): UUIDType {
    if (!uuidValidate(value)) throw this.invalidSubmission();
    return value as UUIDType;
  }

  private invalidSubmission(): BadRequestException {
    return new BadRequestException("studentLessonView.validation.quizEvaluationFailed");
  }
}
