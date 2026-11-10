import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  ASSESSMENT_ANSWER_GRADING_STATUSES,
  ASSESSMENT_ATTEMPT_GRADING_STATUSES,
  ASSESSMENT_ATTEMPT_RESULTS,
  ASSESSMENT_GRADING_MODES,
  COURSE_STATUSES,
  PERMISSIONS,
  QUIZ_REVIEW_GRADING_METHODS,
  type QuizReviewGradingMethod,
} from "@repo/shared";
import { match } from "ts-pattern";

import { DatabasePg, type Pagination, type UUIDType } from "src/common";
import { parsePagination } from "src/common/pagination";
import { courseLearningContext } from "src/course-repetition/course-learning-context";
import { CourseRepetitionService } from "src/course-repetition/course-repetition.service";
import { QuizAttemptGradedEvent } from "src/events";
import { OutboxPublisher } from "src/outbox/outbox.publisher";
import { QuizRuntimeRepository } from "src/quiz/repositories/quiz-runtime.repository";
import { DB } from "src/storage/db/db.providers";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";
import { StudentLessonProgressService } from "src/studentLessonProgress/studentLessonProgress.service";

import { QuizGradingRepository } from "./quiz-grading.repository";

import type {
  GradeQuizAnswerBody,
  GradeQuizAnswerResponse,
  QuizGradingAnswerDetailsResponse,
  QuizGradingAnswerListResponse,
} from "./quiz-grading.schema";
import type { QuizAnswerForGrading, QuizGradingAnswerFilters } from "./quiz-grading.types";
import type { CurrentUserType } from "src/common/types/current-user.type";

// Reviewers complete lessons on the learner's behalf, like trainers do for live trainings.
const LEARNER_PROGRESS_PERMISSIONS = [PERMISSIONS.LEARNING_PROGRESS_UPDATE];

@Injectable()
export class QuizGradingService {
  constructor(
    @Inject(DB) private readonly db: DatabasePg,
    private readonly quizGradingRepository: QuizGradingRepository,
    private readonly quizRuntimeRepository: QuizRuntimeRepository,
    private readonly studentLessonProgressService: StudentLessonProgressService,
    private readonly courseRepetitionService: CourseRepetitionService,
    private readonly outboxPublisher: OutboxPublisher,
    private readonly tenantDbRunnerService: TenantDbRunnerService,
  ) {}

  async getAnswers(
    filters: QuizGradingAnswerFilters,
    reviewerId: UUIDType,
    pageInput?: number,
    perPageInput?: number,
  ): Promise<{ data: QuizGradingAnswerListResponse; pagination: Pagination }> {
    const { page, perPage } = parsePagination(pageInput, perPageInput);
    const { data, totalItems } = await this.quizGradingRepository.findAnswers(
      filters,
      reviewerId,
      page,
      perPage,
    );

    return { data, pagination: { totalItems, page, perPage } };
  }

  getFilterOptions(reviewerId: UUIDType) {
    return this.quizGradingRepository.findFilterOptions(reviewerId);
  }

  async getAnswerDetails(
    answerId: UUIDType,
    reviewerId: UUIDType,
  ): Promise<QuizGradingAnswerDetailsResponse> {
    const answer = await this.quizGradingRepository.findAnswerDetails(answerId, reviewerId);

    if (!answer) throw new NotFoundException("quizGrading.errors.answerNotFound");

    const [reviews, nextAnswerId] = await Promise.all([
      this.quizGradingRepository.findReviews(answerId),
      this.quizGradingRepository.findNextPendingAnswerId(answerId, reviewerId),
    ]);

    return { ...answer, reviews, nextAnswerId };
  }

  async gradeAnswer(
    answerId: UUIDType,
    { comment, ...grade }: GradeQuizAnswerBody,
    currentUser: CurrentUserType,
  ): Promise<GradeQuizAnswerResponse> {
    return this.tenantDbRunnerService.transaction(async () => {
      const lockTarget = await this.quizGradingRepository.findAnswerForGrading(answerId, this.db);

      if (!lockTarget) throw new NotFoundException("quizGrading.errors.answerNotFound");

      await this.courseRepetitionService.lock(lockTarget.courseId, lockTarget.studentId, this.db);

      // Re-read under the lock so concurrent grades of one attempt see each other's commits.
      const answer = await this.quizGradingRepository.findAnswerForGrading(answerId, this.db);

      if (!answer || answer.gradingMode !== ASSESSMENT_GRADING_MODES.MANUAL)
        throw new NotFoundException("quizGrading.errors.answerNotFound");

      if (answer.studentId === currentUser.userId)
        throw new ForbiddenException("quizGrading.errors.ownAnswer");

      // Grading may complete the lesson, which needs a published course and an enrolled learner.
      if (answer.courseStatus === COURSE_STATUSES.DRAFT)
        throw new ConflictException("quizGrading.errors.courseNotPublished");

      if (!answer.isLearnerEnrolled)
        throw new ConflictException("quizGrading.errors.learnerNotEnrolled");

      const awardedPoints = match(grade)
        .with({ method: QUIZ_REVIEW_GRADING_METHODS.PASS_FAIL }, ({ passed }) =>
          passed ? answer.maximumPoints : 0,
        )
        .exhaustive();

      // The learner moved on to a newer learning state (e.g. repeated the course).
      const learningStateId = await this.courseRepetitionService
        .resolveWritableState(answer.courseId, answer.studentId, answer.learningStateId, this.db)
        .catch((error: unknown) => {
          if (error instanceof ConflictException)
            throw new ConflictException("quizGrading.errors.attemptSuperseded");
          throw error;
        });

      const attemptGraded = await courseLearningContext.run({ learningStateId }, () =>
        this.recordGrade(answer, grade.method, awardedPoints, comment ?? "", currentUser),
      );
      // Read inside the transaction so a failed lookup can't report a saved grade as failed.
      const nextAnswerId = await this.quizGradingRepository.findNextPendingAnswerId(
        answerId,
        currentUser.userId,
        this.db,
      );

      return { attemptGraded, nextAnswerId };
    });
  }

  private async recordGrade(
    answer: QuizAnswerForGrading,
    gradingMethod: QuizReviewGradingMethod,
    awardedPoints: number,
    comment: string,
    currentUser: CurrentUserType,
  ) {
    await this.quizGradingRepository.insertReview(
      {
        questionAnswerId: answer.id,
        reviewerId: currentUser.userId,
        gradingMethod,
        awardedPoints: String(awardedPoints),
        explanation: comment,
        explanationLanguage: answer.language,
      },
      this.db,
    );
    await this.quizGradingRepository.markAnswerGraded(answer.id, awardedPoints, this.db);

    const attemptAnswers = await this.quizGradingRepository.findAttemptAnswers(
      answer.attemptId,
      this.db,
    );

    if (
      attemptAnswers.some(
        ({ gradingStatus }) => gradingStatus === ASSESSMENT_ANSWER_GRADING_STATUSES.PENDING,
      )
    )
      return false;

    const totalPoints = attemptAnswers.reduce(
      (total, { awardedPoints }) => total + awardedPoints,
      0,
    );
    const scorePercentage = answer.availablePoints
      ? (totalPoints / answer.availablePoints) * 100
      : 0;
    const isQuizPassed = scorePercentage >= answer.passingScorePercentage;
    const isRegrade = answer.attemptGradingStatus === ASSESSMENT_ATTEMPT_GRADING_STATUSES.GRADED;
    const score = Math.floor(scorePercentage);

    await this.quizGradingRepository.updateGradedAttempt(
      answer.attemptId,
      {
        gradingStatus: ASSESSMENT_ATTEMPT_GRADING_STATUSES.GRADED,
        result: isQuizPassed
          ? ASSESSMENT_ATTEMPT_RESULTS.PASSED
          : ASSESSMENT_ATTEMPT_RESULTS.FAILED,
        awardedPoints: totalPoints.toString(),
        scorePercentage: scorePercentage.toFixed(2),
        ...(isRegrade ? {} : { gradedAt: new Date().toISOString() }),
      },
      this.db,
    );

    if (isRegrade) {
      await this.updateRegradedProgress(answer, score, isQuizPassed, currentUser);
    } else {
      await this.studentLessonProgressService.finishQuizProgress({
        chapterId: answer.chapterId,
        courseId: answer.courseId,
        lessonId: answer.lessonId,
        studentId: answer.studentId,
        questionCount: attemptAnswers.length,
        correctAnswerCount: attemptAnswers.filter(({ awardedPoints }) => awardedPoints > 0).length,
        score,
        attemptNumber: answer.attemptNumber,
        isQuizPassed,
        language: answer.language,
        userPermissions: LEARNER_PROGRESS_PERMISSIONS,
        actor: currentUser,
        isSupportMode: false,
        dbInstance: this.db,
      });
    }

    await this.outboxPublisher.publish(
      new QuizAttemptGradedEvent({
        userId: answer.studentId,
        courseId: answer.courseId,
        lessonId: answer.lessonId,
        attemptId: answer.attemptId,
        reviewerId: currentUser.userId,
        score,
        passed: isQuizPassed,
        isRegrade,
      }),
      this.db,
    );

    return true;
  }

  // A re-grade refreshes the score of the learner's latest completed result but never reopens a lesson.
  private async updateRegradedProgress(
    answer: QuizAnswerForGrading,
    score: number,
    isQuizPassed: boolean,
    currentUser: CurrentUserType,
  ) {
    const latestAttempt = await this.quizRuntimeRepository.findLatestAttempt(
      answer.assessmentId,
      answer.studentId,
      this.db,
    );
    const progress = await this.quizGradingRepository.findLessonProgress(
      answer.lessonId,
      answer.studentId,
      this.db,
    );

    // A newer attempt, a reset for a retake or missing progress: nothing to refresh.
    if (latestAttempt?.id !== answer.attemptId || !progress?.completedAt) return;

    const wasPassed = Boolean(progress.isQuizPassed);

    await this.quizGradingRepository.updateLessonProgressScore(
      progress.id,
      { quizScore: score, isQuizPassed: wasPassed || isQuizPassed },
      this.db,
    );

    if (!isQuizPassed || wasPassed) return;

    await this.studentLessonProgressService.markLessonAsCompleted({
      id: answer.lessonId,
      studentId: answer.studentId,
      userPermissions: LEARNER_PROGRESS_PERMISSIONS,
      actor: currentUser,
      quizCompleted: true,
      completedQuestionCount: progress.completedQuestionCount ?? 0,
      dbInstance: this.db,
      isQuizPassed,
      language: answer.language,
    });
  }
}
