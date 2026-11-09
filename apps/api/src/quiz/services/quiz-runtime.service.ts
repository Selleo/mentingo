import { createHash, randomUUID } from "node:crypto";

import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import {
  ASSESSMENT_ANSWER_GRADING_STATUSES,
  ASSESSMENT_ATTEMPT_GRADING_STATUSES,
  ASSESSMENT_ATTEMPT_RESULTS,
  ASSESSMENT_QUESTION_TYPES,
  ASSESSMENT_SCORING_MODES,
  ASSESSMENT_TEXT_COMPARISON_MODES,
  type SupportedLanguages,
} from "@repo/shared";
import { escape, sortBy } from "lodash";
import { match } from "ts-pattern";

import { BLANK_ANSWER_MARKER_REGEX } from "src/questions/fill-in-the-blanks.utils";

import { normalizeBlankPromptMarkers } from "../mappers/quiz-authoring-mapper.utils";
import {
  mapQuizAttemptToRuntimeSubmissionResult,
  mapQuizQuestionDescriptionForDelivery,
} from "../mappers/quiz-runtime.mapper";
import { QuizRuntimeRepository } from "../repositories/quiz-runtime.repository";
import { isAttemptNumberConflict } from "../utils/quiz-attempt-conflict";

import { QuizAttemptService } from "./quiz-attempt.service";
import { QuizAuthoringService } from "./quiz-authoring.service";

import type { QuizAttemptDraftAnswers } from "../repositories/quiz-runtime.repository.types";
import type {
  QuizAuthoringLocalizedQuestion,
  QuizAuthoringLocalizedReadModel,
} from "../types/quiz-authoring.types";
import type {
  PreparedQuizAttempt,
  QuizDelivery,
  QuizAttemptFeedback,
  QuizOpenAttempt,
  QuizRuntimeSubmissionResult,
  QuizSubmission,
  QuizTimedSubmissionOptions,
} from "../types/quiz-runtime.types";
import type { DatabasePg, UUIDType } from "src/common";
import type { QuestionBody } from "src/lesson/lesson.schema";

@Injectable()
export class QuizRuntimeService {
  private readonly logger = new Logger(QuizRuntimeService.name);

  constructor(
    private readonly quizAuthoringService: QuizAuthoringService,
    private readonly quizAttemptService: QuizAttemptService,
    private readonly quizRuntimeRepository: QuizRuntimeRepository,
  ) {}

  async getQuizForDelivery(
    lessonId: UUIDType,
    language?: SupportedLanguages,
    learnerId?: UUIDType,
    includeFeedback = false,
  ): Promise<QuizDelivery> {
    const quizDefinition = await this.quizAuthoringService.getQuizLessonForAuthoring(
      lessonId,
      language,
    );

    if (!quizDefinition) throw new NotFoundException("common.toast.notFound");

    const attemptFeedback =
      includeFeedback && learnerId
        ? await this.quizAttemptService.findLatestAttemptFeedback(
            quizDefinition.assessment.id,
            learnerId,
          )
        : null;

    return {
      assessmentId: quizDefinition.assessment.id,
      timeLimitMinutes: quizDefinition.assessment.timeLimitMinutes,
      questions: quizDefinition.questions.map((question) =>
        this.mapQuestionForDelivery(question, attemptFeedback),
      ),
    };
  }

  async submitQuiz(
    submission: QuizSubmission,
    learnerId: UUIDType,
    db?: DatabasePg,
  ): Promise<QuizRuntimeSubmissionResult> {
    const quizDefinition = await this.getQuizDefinitionForSubmission(submission);
    const attemptData = this.prepareAttempt(quizDefinition, submission, learnerId);
    const persistedAttempt = await this.quizAttemptService.createSubmittedAttempt(attemptData, db);

    return mapQuizAttemptToRuntimeSubmissionResult(attemptData, persistedAttempt);
  }

  /** Grades an open timed attempt in place; null when another request already finalized it. */
  async finalizeTimedAttempt(
    submission: QuizSubmission,
    learnerId: UUIDType,
    attemptId: UUIDType,
    db?: DatabasePg,
    { dropInvalidAnswers = false }: QuizTimedSubmissionOptions = {},
  ): Promise<QuizRuntimeSubmissionResult | null> {
    const quizDefinition = await this.getQuizDefinitionForSubmission(submission);
    const attemptData = this.prepareAttempt(
      quizDefinition,
      dropInvalidAnswers
        ? this.dropInvalidAnswers(quizDefinition, submission, learnerId, attemptId)
        : submission,
      learnerId,
      true,
    );
    const finalizedAttempt = await this.quizAttemptService.finalizeTimedAttempt(
      attemptId,
      attemptData,
      db,
    );

    return finalizedAttempt
      ? mapQuizAttemptToRuntimeSubmissionResult(attemptData, finalizedAttempt)
      : null;
  }

  async getTimeLimitMinutes(lessonId: UUIDType) {
    const assessment = await this.quizRuntimeRepository.findAssessmentTimeLimit(lessonId);
    return assessment?.timeLimitMinutes ?? null;
  }

  findOpenAttempt(lessonId: UUIDType, learnerId: UUIDType): Promise<QuizOpenAttempt | null> {
    return this.quizRuntimeRepository.findOpenAttemptByLesson(lessonId, learnerId);
  }

  findOpenAttemptById(attemptId: UUIDType): Promise<QuizOpenAttempt | null> {
    return this.quizRuntimeRepository.findOpenAttemptById(attemptId);
  }

  async startTimedAttempt(
    lessonId: UUIDType,
    learnerId: UUIDType,
    language: SupportedLanguages,
  ): Promise<QuizOpenAttempt> {
    const quizDefinition = await this.getQuizDefinitionForSubmission({ lessonId, language });
    const { timeLimitMinutes } = quizDefinition.assessment;

    if (!timeLimitMinutes)
      throw new BadRequestException("studentLessonView.validation.quizNotTimed");

    const attempt = await this.quizAttemptService
      .startTimedAttempt({
        assessmentId: quizDefinition.assessment.id,
        learnerId,
        language,
        availablePoints: this.sumAvailablePoints(quizDefinition).toString(),
        timeLimitMinutes,
      })
      .catch(async (error: unknown) => {
        // A concurrent start (e.g. two tabs) already took this attempt number.
        if (!isAttemptNumberConflict(error)) throw error;
        return this.quizRuntimeRepository.findOpenAttemptByLesson(lessonId, learnerId);
      });

    if (!attempt) throw this.invalidSubmission();

    return attempt;
  }

  findLatestAttemptByLesson(lessonId: UUIDType, learnerId: UUIDType) {
    return this.quizRuntimeRepository.findLatestAttemptByLesson(lessonId, learnerId);
  }

  cancelOpenAttempt(attemptId: UUIDType) {
    return this.quizRuntimeRepository.cancelOpenAttempt(attemptId);
  }

  /** Validates the draft like a lenient submission, then stores it while the attempt is open. */
  async saveDraftAnswers(attempt: QuizOpenAttempt, draftAnswers: QuizAttemptDraftAnswers) {
    const submission = {
      lessonId: attempt.lessonId,
      language: attempt.language,
      questionsAnswers: draftAnswers,
    };
    const quizDefinition = await this.getQuizDefinitionForSubmission(submission);

    try {
      this.prepareAttempt(quizDefinition, submission, attempt.learnerId, true);
    } catch {
      throw new BadRequestException("studentLessonView.validation.quizDraftInvalid");
    }

    return this.quizRuntimeRepository.saveDraftAnswers(attempt.id, attempt.learnerId, draftAnswers);
  }

  private async getQuizDefinitionForSubmission(
    submission: Pick<QuizSubmission, "lessonId" | "language">,
  ) {
    const quizDefinition = await this.quizAuthoringService.getQuizLessonForAuthoring(
      submission.lessonId,
      submission.language,
    );

    if (!quizDefinition) throw this.invalidSubmission();

    return quizDefinition;
  }

  private sumAvailablePoints(quizDefinition: QuizAuthoringLocalizedReadModel) {
    return quizDefinition.questions.reduce(
      (total, question) => total + Number(question.maximumPoints),
      0,
    );
  }

  private mapQuestionForDelivery(
    question: QuizAuthoringLocalizedQuestion,
    attemptFeedback: QuizAttemptFeedback | null,
  ): QuestionBody {
    const deliveryQuestion = {
      ...question,
      prompt: normalizeBlankPromptMarkers(
        question.prompt,
        question.blanks.map(({ id }) => id),
      ),
    };
    const questionAnswer = attemptFeedback?.questionAnswers.find(
      (answer) => answer.questionId === question.id,
    );
    const hasFeedback = Boolean(questionAnswer);

    const choiceSelections = new Set(
      attemptFeedback?.choiceSelections
        .filter(({ questionAnswerId }) => questionAnswerId === questionAnswer?.id)
        .map(({ selectedOptionId }) => selectedOptionId),
    );

    const statementAnswers = attemptFeedback?.statementAnswers.filter(
      (answer) => answer.questionAnswerId === questionAnswer?.id,
    );
    const blankAnswers = attemptFeedback?.blankAnswers.filter(
      (answer) => answer.questionAnswerId === questionAnswer?.id,
    );
    const scaleSelection = attemptFeedback?.scaleSelections.find(
      (selection) => selection.questionAnswerId === questionAnswer?.id,
    );
    const matchingAnswers = attemptFeedback?.matchingAnswers.filter(
      (answer) => answer.questionAnswerId === questionAnswer?.id,
    );
    const openTextAnswer = attemptFeedback?.openTextAnswers.find(
      (answer) => answer.questionAnswerId === questionAnswer?.id,
    );
    const openTextFeedbackOption =
      hasFeedback && openTextAnswer
        ? this.mapDeliveryOption(
            question.id,
            questionAnswer!.id,
            "",
            1,
            undefined,
            true,
            true,
            true,
            openTextAnswer.submittedText,
          )
        : null;

    const deliveryOptions = [
      ...question.options.map((option) =>
        this.mapDeliveryOption(
          question.id,
          option.id,
          option.label,
          option.displayOrder,
          undefined,
          hasFeedback,
          choiceSelections.has(option.id),
          option.isCorrect,
        ),
      ),
      ...question.trueFalseStatements.map((statement) =>
        this.mapDeliveryOption(
          question.id,
          statement.id,
          statement.statement,
          statement.displayOrder,
          undefined,
          hasFeedback,
          statementAnswers?.some(({ statementId }) => statementId === statement.id) ?? false,
          statement.correctValue,
          statementAnswers
            ?.find(({ statementId }) => statementId === statement.id)
            ?.submittedValue.toString() ?? null,
        ),
      ),
      ...question.scaleOptions.map((option) =>
        this.mapDeliveryOption(
          question.id,
          option.id,
          option.label,
          option.displayOrder,
          option.scaleValue,
          hasFeedback,
          scaleSelection?.selectedScaleOptionId === option.id,
          false,
        ),
      ),
      ...(question.questionType === ASSESSMENT_QUESTION_TYPES.FILL_IN_THE_BLANKS_TEXT
        ? question.blanks.map((blank, index) => {
            const submittedBlankAnswer = blankAnswers?.find(
              (answer) => answer.blankId === blank.id,
            );
            const preferredAnswer = blank.answerSets[0]?.preferredAnswer ?? null;

            return this.mapDeliveryOption(
              question.id,
              blank.id,
              hasFeedback ? preferredAnswer : null,
              index + 1,
              undefined,
              hasFeedback,
              Boolean(submittedBlankAnswer),
              hasFeedback
                ? this.isBlankAnswerCorrect(blank, submittedBlankAnswer?.submittedText)
                : null,
              submittedBlankAnswer?.submittedText ?? null,
            );
          })
        : []),
      ...question.dragAndDropOptions.map((option) =>
        this.mapDeliveryOption(
          question.id,
          option.targetBlankId ?? option.id,
          option.label,
          option.displayOrder,
          undefined,
          hasFeedback,
          Boolean(blankAnswers?.some((answer) => answer.selectedDragOptionId === option.id)),
          hasFeedback
            ? Boolean(
                blankAnswers?.some((answer) => {
                  const selectedOption = question.dragAndDropOptions.find(
                    (dragOption) => dragOption.id === option.id,
                  );
                  return (
                    answer.selectedDragOptionId === option.id &&
                    selectedOption?.targetBlankId === answer.blankId
                  );
                }),
              )
            : null,
        ),
      ),
      ...question.matchingPairs.map((pair) => {
        const submittedMatch =
          matchingAnswers?.find(({ pairId }) => pairId === pair.id)?.submittedMatch ?? null;

        return {
          ...this.mapDeliveryOption(
            question.id,
            pair.id,
            pair.prompt,
            pair.displayOrder,
            undefined,
            hasFeedback,
            submittedMatch !== null,
            submittedMatch === pair.match,
            submittedMatch,
          ),
          matchedWord: hasFeedback ? pair.match : null,
        };
      }),
      ...(openTextFeedbackOption ? [openTextFeedbackOption] : []),
    ];

    return {
      id: question.id,
      type: question.questionType,
      title: question.title,
      description: mapQuizQuestionDescriptionForDelivery(deliveryQuestion),
      displayOrder: question.displayOrder,
      solutionExplanation: hasFeedback ? this.buildSolutionExplanation(deliveryQuestion) : null,
      photoS3Key: question.photoS3Key,
      options: deliveryOptions,
      passQuestion: hasFeedback
        ? Number(questionAnswer?.awardedPoints ?? 0) >= Number(question.maximumPoints)
        : null,
      ...(question.questionType === ASSESSMENT_QUESTION_TYPES.MATCHING
        ? { matchingTargets: this.shuffleMatchingTargets(question) }
        : {}),
    };
  }

  // Deterministic per question and match text, so refetches keep the order; independent of pair order.
  private shuffleMatchingTargets(question: QuizAuthoringLocalizedQuestion) {
    return sortBy(
      // Untranslated pairs have empty matches, which are not selectable.
      question.matchingPairs.map(({ match }) => match).filter((match) => match !== ""),
      (match) => createHash("sha256").update(`${question.id}:${match}`).digest("hex"),
    );
  }

  private mapDeliveryOption(
    questionId: UUIDType,
    id: UUIDType,
    optionText: string | null,
    displayOrder: number,
    scaleAnswer?: number,
    hasFeedback = false,
    isStudentAnswer: boolean | null = null,
    isCorrect: boolean | null = null,
    studentAnswer: string | null = null,
  ) {
    return {
      id,
      optionText,
      displayOrder,
      isStudentAnswer: hasFeedback ? isStudentAnswer : null,
      studentAnswer: hasFeedback ? (studentAnswer ?? (isStudentAnswer ? optionText : null)) : null,
      isCorrect: hasFeedback ? isCorrect : null,
      questionId,
      ...(scaleAnswer === undefined ? {} : { scaleAnswer }),
    };
  }

  private isBlankAnswerCorrect(
    blank: QuizAuthoringLocalizedQuestion["blanks"][number],
    submittedText: string | null | undefined,
  ) {
    if (submittedText == null) return false;

    return blank.answerSets.some((answerSet) => answerSet.acceptedAnswers.includes(submittedText));
  }

  private buildSolutionExplanation(question: QuizAuthoringLocalizedQuestion) {
    return match(question.questionType)
      .with(
        ASSESSMENT_QUESTION_TYPES.FILL_IN_THE_BLANKS_TEXT,
        ASSESSMENT_QUESTION_TYPES.FILL_IN_THE_BLANKS_DND,
        () => this.buildFillInTheBlanksSolutionSentence(question),
      )
      .otherwise(() => this.buildAnswerListSolutionExplanation(question));
  }

  private buildAnswerListSolutionExplanation(question: QuizAuthoringLocalizedQuestion) {
    const correctAnswers = [
      ...question.options.filter((option) => option.isCorrect).map((option) => option.label),
      ...question.trueFalseStatements
        .filter((statement) => statement.correctValue)
        .map((statement) => statement.statement),
      ...question.blanks
        .map((blank) => blank.answerSets[0]?.preferredAnswer)
        .filter((answer): answer is string => Boolean(answer)),
      ...question.matchingPairs.map((pair) => `${pair.prompt} – ${pair.match}`),
    ];

    return correctAnswers.length ? correctAnswers.join(", ") : null;
  }

  private buildFillInTheBlanksSolutionSentence(question: QuizAuthoringLocalizedQuestion) {
    if (!question.prompt) return null;

    let unresolvedBlank = false;
    const sentence = question.prompt.replace(
      BLANK_ANSWER_MARKER_REGEX,
      (marker, blankId: UUIDType) => {
        const blank = question.blanks.find((candidate) => candidate.id === blankId);
        const correctAnswer =
          blank?.answerSets[0]?.preferredAnswer ??
          question.dragAndDropOptions.find((option) => option.targetBlankId === blankId)?.label;

        if (!correctAnswer) {
          unresolvedBlank = true;
          return marker;
        }

        return `<strong>${escape(correctAnswer)}</strong>`;
      },
    );

    return unresolvedBlank ? null : sentence;
  }

  /** A stored draft may reference questions or options removed since it was saved; those score 0. */
  private dropInvalidAnswers(
    quizDefinition: QuizAuthoringLocalizedReadModel,
    submission: QuizSubmission,
    learnerId: UUIDType,
    attemptId?: UUIDType,
  ): QuizSubmission {
    const questionById = new Map(
      quizDefinition.questions.map((question) => [question.id, question]),
    );
    const keptQuestionIds = new Set<string>();
    const droppedQuestionIds: string[] = [];

    const questionsAnswers = submission.questionsAnswers.filter((submittedQuestion) => {
      const quizQuestion = questionById.get(submittedQuestion.questionId);
      const isValid =
        quizQuestion !== undefined &&
        !keptQuestionIds.has(submittedQuestion.questionId) &&
        this.canMapAnswers(
          quizDefinition,
          submission,
          learnerId,
          quizQuestion,
          submittedQuestion.answers,
        );

      if (isValid) keptQuestionIds.add(submittedQuestion.questionId);
      else droppedQuestionIds.push(submittedQuestion.questionId);

      return isValid;
    });

    if (droppedQuestionIds.length)
      this.logger.warn(
        `Dropped stale quiz draft answers (lessonId=${submission.lessonId}, learnerId=${learnerId}, attemptId=${attemptId}, questionIds=${droppedQuestionIds.join(",")})`,
      );

    return { ...submission, questionsAnswers };
  }

  private canMapAnswers(
    quizDefinition: QuizAuthoringLocalizedReadModel,
    submission: QuizSubmission,
    learnerId: UUIDType,
    quizQuestion: QuizAuthoringLocalizedQuestion,
    answers: QuizSubmission["questionsAnswers"][number]["answers"],
  ) {
    if (!answers.length) return true;

    try {
      this.mapSubmittedAnswers(
        this.createAttemptData(quizDefinition, submission, learnerId, new Date().toISOString()),
        quizQuestion,
        quizQuestion.id,
        answers,
      );
      return true;
    } catch {
      return false;
    }
  }

  private createAttemptData(
    quizDefinition: QuizAuthoringLocalizedReadModel,
    submission: QuizSubmission,
    learnerId: UUIDType,
    submittedAt: string,
  ): PreparedQuizAttempt {
    return {
      assessmentId: quizDefinition.assessment.id,
      correctAnswerCount: 0,
      learnerId,
      language: submission.language,
      availablePoints: this.sumAvailablePoints(quizDefinition).toString(),
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
      matchingAnswers: [],
    };
  }

  private prepareAttempt(
    quizDefinition: QuizAuthoringLocalizedReadModel,
    submission: QuizSubmission,
    learnerId: UUIDType,
    allowUnanswered = false,
  ): PreparedQuizAttempt {
    const questionById = new Map(
      quizDefinition.questions.map((question) => [question.id, question]),
    );
    const submittedQuestionIds = new Set<string>();

    const submittedAt = new Date().toISOString();
    const availablePoints = this.sumAvailablePoints(quizDefinition);

    const attemptData = this.createAttemptData(quizDefinition, submission, learnerId, submittedAt);

    for (const submittedQuestion of submission.questionsAnswers) {
      const quizQuestion = questionById.get(submittedQuestion.questionId);

      if (!quizQuestion || submittedQuestionIds.has(submittedQuestion.questionId))
        throw new BadRequestException("studentLessonView.validation.quizEvaluationFailed");

      submittedQuestionIds.add(submittedQuestion.questionId);

      if (allowUnanswered && !submittedQuestion.answers.length) continue;

      const questionAnswerId = randomUUID();
      const awardedPoints = this.scoreQuestionAnswer(quizQuestion, submittedQuestion.answers);
      if (awardedPoints >= Number(quizQuestion.maximumPoints)) attemptData.correctAnswerCount += 1;

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

    if (!allowUnanswered && submittedQuestionIds.size !== quizDefinition.questions.length)
      throw new BadRequestException("studentLessonView.validation.quizEvaluationFailed");

    if (allowUnanswered) {
      const answeredQuestionIds = new Set(
        attemptData.questionAnswers.map(({ questionId }) => questionId),
      );

      for (const question of quizDefinition.questions) {
        if (answeredQuestionIds.has(question.id)) continue;

        attemptData.questionAnswers.push({
          id: randomUUID(),
          questionId: question.id,
          gradingStatus: ASSESSMENT_ANSWER_GRADING_STATUSES.GRADED,
          awardedPoints: "0",
          submittedAt,
        });
      }
    }

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

  private scoreQuestionAnswer(
    quizQuestion: QuizAuthoringLocalizedQuestion,
    answers: QuizSubmission["questionsAnswers"][number]["answers"],
  ) {
    const maximumPoints = Number(quizQuestion.maximumPoints);

    if (quizQuestion.questionType !== ASSESSMENT_QUESTION_TYPES.MATCHING)
      return this.gradeQuestionAnswer(quizQuestion, answers) ? maximumPoints : 0;

    const correctPairs = quizQuestion.matchingPairs.filter(
      (pair) =>
        pair.match !== "" &&
        answers.some(
          (answer) =>
            "answerId" in answer &&
            "value" in answer &&
            answer.answerId === pair.id &&
            answer.value === pair.match,
        ),
    ).length;
    const totalPairs = quizQuestion.matchingPairs.length;

    // Imported or untranslated questions may have no pairs; never award free points.
    if (!totalPairs) return 0;

    if (quizQuestion.scoringMode === ASSESSMENT_SCORING_MODES.PARTIAL)
      return Math.round((maximumPoints * correctPairs * 100) / totalPairs) / 100;

    return correctPairs === totalPairs ? maximumPoints : 0;
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

      const selectedDragOption = this.findDragAndDropOption(quizQuestion, submittedAnswer.value);

      return selectedDragOption?.targetBlankId === blank.id;
    });
  }

  private findDragAndDropOption(
    quizQuestion: QuizAuthoringLocalizedQuestion,
    submittedValue: string,
  ) {
    return quizQuestion.dragAndDropOptions.find(
      (option) => option.id === submittedValue || option.label === submittedValue,
    );
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
      .with(ASSESSMENT_QUESTION_TYPES.MATCHING, () =>
        this.mapMatchingAnswers(attemptData, quizQuestion, questionAnswerId, answers),
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
    for (const [answerIndex, answer] of answers.entries()) {
      if (!("value" in answer)) throw this.invalidSubmission();

      const selectedDragOption = isDragAndDrop
        ? this.findDragAndDropOption(quizQuestion, answer.value)
        : undefined;

      if (isDragAndDrop && !selectedDragOption) throw this.invalidSubmission();

      const submittedBlank = this.resolveSubmittedBlank(quizQuestion, answer, answerIndex);

      if (!submittedBlank) throw this.invalidSubmission();

      attemptData.blankAnswers.push({
        questionAnswerId,
        blankId: submittedBlank.id,
        submittedText: selectedDragOption ? null : answer.value,
        selectedDragOptionId: selectedDragOption?.id ?? null,
      });
    }
  }

  private resolveSubmittedBlank(
    quizQuestion: QuizAuthoringLocalizedQuestion,
    answer: QuizSubmission["questionsAnswers"][number]["answers"][number],
    answerIndex: number,
  ) {
    if ("answerId" in answer) {
      const submittedBlank = quizQuestion.blanks.find((blank) => blank.id === answer.answerId);
      if (submittedBlank) return submittedBlank;
    }

    return quizQuestion.blanks[answerIndex];
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

  private mapMatchingAnswers(
    attemptData: PreparedQuizAttempt,
    quizQuestion: QuizAuthoringLocalizedQuestion,
    questionAnswerId: UUIDType,
    answers: QuizSubmission["questionsAnswers"][number]["answers"],
  ) {
    const answeredPairIds = new Set<UUIDType>();
    const matches = new Set(
      quizQuestion.matchingPairs.map(({ match }) => match).filter((match) => match !== ""),
    );

    for (const answer of answers) {
      if (!("answerId" in answer) || !("value" in answer)) throw this.invalidSubmission();
      if (answeredPairIds.has(answer.answerId) || !matches.has(answer.value))
        throw this.invalidSubmission();

      this.assertIdBelongsToQuestion(answer.answerId, quizQuestion.matchingPairs);
      answeredPairIds.add(answer.answerId);

      attemptData.matchingAnswers.push({
        questionAnswerId,
        pairId: answer.answerId,
        submittedMatch: answer.value,
      });
    }
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

  private invalidSubmission(): BadRequestException {
    return new BadRequestException("studentLessonView.validation.quizEvaluationFailed");
  }
}
