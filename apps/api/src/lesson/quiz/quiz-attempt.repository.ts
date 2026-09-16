import { randomInt, randomUUID } from "node:crypto";

import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, asc, count, eq, inArray } from "drizzle-orm";

import { DatabasePg, type UUIDType } from "src/common";
import { QuizCompletedEvent } from "src/events";
import { OutboxPublisher } from "src/outbox/outbox.publisher";
import { QUESTION_TYPE } from "src/questions/schema/question.types";
import { DB } from "src/storage/db/db.providers";
import {
  chapters,
  lessons,
  questionAnswerOptions,
  questions,
  studentLessonProgress,
  studentQuestionAnswers,
} from "src/storage/schema";
import { isQuizAccessAllowed } from "src/utils/isQuizAccessAllowed";
import { settingsToJSONBuildObject } from "src/utils/settings-to-json-build-object";

import { LESSON_TYPES } from "../lesson.type";

import { hasQuizAttemptConfiguration } from "./quiz-settings";

import type { QuizAttemptState, QuizEvaluationResult, QuizSettings } from "./quiz.types";
import type { SupportedLanguages } from "@repo/shared";

export function shuffleQuizIds(ids: string[]): string[] {
  const result = [...ids];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function quizDeadline(settings: QuizSettings, now: number): string | null {
  const deadlines: number[] = [];
  if (settings.availableUntil) deadlines.push(Date.parse(settings.availableUntil));
  if (settings.timeLimitMinutes) deadlines.push(now + settings.timeLimitMinutes * 60_000);
  return deadlines.length ? new Date(Math.min(...deadlines)).toISOString() : null;
}

export function isQuizExpired(state: QuizAttemptState, now = Date.now()): boolean {
  return (
    state.status === "active" && state.expiresAt !== null && Date.parse(state.expiresAt) <= now
  );
}

@Injectable()
export class QuizAttemptRepository {
  constructor(
    @Inject(DB) private readonly db: DatabasePg,
    private readonly outbox: OutboxPublisher,
  ) {}

  private condition(lessonId: UUIDType, userId: UUIDType) {
    return and(
      eq(studentLessonProgress.lessonId, lessonId),
      eq(studentLessonProgress.studentId, userId),
    );
  }

  private async lesson(lessonId: UUIDType, tx: DatabasePg) {
    const [lesson] = await tx
      .select({
        id: lessons.id,
        chapterId: lessons.chapterId,
        courseId: chapters.courseId,
        settings: lessons.quizSettings,
        attemptsLimit: lessons.attemptsLimit,
        cooldown: lessons.quizCooldownInHours,
      })
      .from(lessons)
      .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
      .where(and(eq(lessons.id, lessonId), eq(lessons.type, LESSON_TYPES.QUIZ)));
    if (!lesson) throw new NotFoundException("common.toast.notFound");
    return lesson;
  }

  private assertAvailable(settings: QuizSettings) {
    const now = Date.now();
    if (
      (settings.availableFrom && Date.parse(settings.availableFrom) > now) ||
      (settings.availableUntil && Date.parse(settings.availableUntil) <= now)
    ) {
      throw new BadRequestException("quizPoc.errors.unavailable");
    }
  }

  async state(lessonId: UUIDType, userId: UUIDType) {
    const [progress] = await this.db
      .select({ state: studentLessonProgress.quizAttemptState })
      .from(studentLessonProgress)
      .where(this.condition(lessonId, userId));
    const state = progress?.state ?? null;
    if (state && isQuizExpired(state)) return { ...state, status: "expired" as const };
    return state;
  }

  async start(lessonId: UUIDType, userId: UUIDType, language: SupportedLanguages) {
    return this.db.transaction(async (tx) => {
      const lesson = await this.lesson(lessonId, tx);
      await tx
        .insert(studentLessonProgress)
        .values({
          lessonId,
          studentId: userId,
          chapterId: lesson.chapterId,
          languageAnswered: language,
        })
        .onConflictDoNothing();
      const [progress] = await tx
        .select()
        .from(studentLessonProgress)
        .where(this.condition(lessonId, userId))
        .for("update");
      if (progress.quizAttemptState) {
        if (isQuizExpired(progress.quizAttemptState))
          await this.expire(lessonId, userId, progress.quizAttemptState, tx);
        return this.readState(lessonId, userId, tx);
      }
      if (progress.completedAt)
        throw new ConflictException("studentLessonView.validation.quizAlreadyAnswered");
      this.assertAvailable(lesson.settings);
      const attempts = progress.attempts ?? 0;
      if (!lesson.cooldown && lesson.attemptsLimit !== null && attempts >= lesson.attemptsLimit)
        throw new ConflictException("quizPoc.errors.attemptLimit");
      const rows = await tx
        .select({ id: questions.id, type: questions.type })
        .from(questions)
        .where(eq(questions.lessonId, lessonId))
        .orderBy(asc(questions.displayOrder), asc(questions.id));
      if (!rows.length) throw new BadRequestException("quizPoc.errors.noQuestions");
      const options = await tx
        .select({ id: questionAnswerOptions.id, questionId: questionAnswerOptions.questionId })
        .from(questionAnswerOptions)
        .where(
          inArray(
            questionAnswerOptions.questionId,
            rows.map((row) => row.id),
          ),
        )
        .orderBy(asc(questionAnswerOptions.displayOrder), asc(questionAnswerOptions.id));
      const shuffleTypes: string[] = [
        QUESTION_TYPE.SINGLE_CHOICE,
        QUESTION_TYPE.MULTIPLE_CHOICE,
        QUESTION_TYPE.TRUE_OR_FALSE,
        QUESTION_TYPE.PHOTO_QUESTION_SINGLE_CHOICE,
        QUESTION_TYPE.PHOTO_QUESTION_MULTIPLE_CHOICE,
      ];
      const optionOrder = Object.fromEntries(
        rows.map((row) => {
          const ids = options
            .filter((option) => option.questionId === row.id)
            .map((option) => option.id);
          return [
            row.id,
            lesson.settings.shuffleAnswers && shuffleTypes.includes(row.type)
              ? shuffleQuizIds(ids)
              : ids,
          ];
        }),
      );
      const now = Date.now();
      const state: QuizAttemptState = {
        id: randomUUID(),
        startedAt: new Date(now).toISOString(),
        expiresAt: quizDeadline(lesson.settings, now),
        status: "active",
        questionOrder: lesson.settings.shuffleQuestions
          ? shuffleQuizIds(rows.map((row) => row.id))
          : rows.map((row) => row.id),
        optionOrder,
      };
      await tx
        .update(studentLessonProgress)
        .set({
          quizAttemptState: settingsToJSONBuildObject(state),
          attempts: attempts + 1,
          languageAnswered: language,
          isStarted: true,
        })
        .where(this.condition(lessonId, userId));
      return state;
    });
  }

  private async readState(lessonId: UUIDType, userId: UUIDType, tx: DatabasePg) {
    const [row] = await tx
      .select({ state: studentLessonProgress.quizAttemptState })
      .from(studentLessonProgress)
      .where(this.condition(lessonId, userId));
    return row?.state ?? null;
  }

  private async expire(
    lessonId: UUIDType,
    userId: UUIDType,
    state: QuizAttemptState,
    tx: DatabasePg,
  ): Promise<QuizEvaluationResult> {
    const lesson = await this.lesson(lessonId, tx);
    const result = {
      score: 0,
      correctAnswerCount: 0,
      wrongAnswerCount: state.questionOrder.length,
      questionCount: state.questionOrder.length,
    };
    await tx
      .update(studentLessonProgress)
      .set({
        quizAttemptState: settingsToJSONBuildObject({ ...state, status: "expired" }),
        quizScore: 0,
        isQuizPassed: false,
        completedAt: state.expiresAt,
        completedQuestionCount: 0,
      })
      .where(this.condition(lessonId, userId));
    await this.outbox.publish(
      new QuizCompletedEvent({
        userId,
        courseId: lesson.courseId,
        lessonId,
        score: 0,
        correctAnswers: 0,
        wrongAnswers: result.wrongAnswerCount,
      }),
      tx,
    );
    return result;
  }

  async finishExpired(lessonId: UUIDType, userId: UUIDType) {
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .select()
        .from(studentLessonProgress)
        .where(this.condition(lessonId, userId))
        .for("update");
      if (row?.quizAttemptState && isQuizExpired(row.quizAttemptState))
        await this.expire(lessonId, userId, row.quizAttemptState, tx);
      return this.readState(lessonId, userId, tx);
    });
  }

  async submit(
    lessonId: UUIDType,
    userId: UUIDType,
    attemptId: string | undefined,
    evaluate: (tx: DatabasePg) => Promise<QuizEvaluationResult>,
  ): Promise<QuizEvaluationResult> {
    return this.db.transaction(async (tx) => {
      const lesson = await this.lesson(lessonId, tx);
      const [progress] = await tx
        .select()
        .from(studentLessonProgress)
        .where(this.condition(lessonId, userId))
        .for("update");
      const state = progress?.quizAttemptState;
      if (!state) {
        if (hasQuizAttemptConfiguration(lesson.settings) || attemptId)
          throw new ConflictException("quizPoc.errors.startRequired");
        return evaluate(tx);
      }
      if (attemptId !== state.id) throw new ConflictException("quizPoc.errors.staleAttempt");
      if (isQuizExpired(state)) return this.expire(lessonId, userId, state, tx);
      if (state.status !== "active") {
        const [correct] = await tx
          .select({ value: count() })
          .from(studentQuestionAnswers)
          .where(
            and(
              eq(studentQuestionAnswers.studentId, userId),
              eq(studentQuestionAnswers.isCorrect, true),
              inArray(studentQuestionAnswers.questionId, state.questionOrder),
            ),
          );
        return {
          score: progress.quizScore ?? 0,
          correctAnswerCount: correct.value,
          wrongAnswerCount: state.questionOrder.length - correct.value,
          questionCount: state.questionOrder.length,
        };
      }
      this.assertAvailable(lesson.settings);
      const result = await evaluate(tx);
      await tx
        .update(studentLessonProgress)
        .set({ quizAttemptState: settingsToJSONBuildObject({ ...state, status: "submitted" }) })
        .where(this.condition(lessonId, userId));
      return result;
    });
  }

  async reset(lessonId: UUIDType, userId: UUIDType): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const [progress] = await tx
        .select()
        .from(studentLessonProgress)
        .where(this.condition(lessonId, userId))
        .for("update");
      const state = progress?.quizAttemptState;
      if (!state) return false;
      const expired = isQuizExpired(state);
      if (expired) await this.expire(lessonId, userId, state, tx);
      if (state.status === "active" && !expired)
        throw new ConflictException("studentLessonView.validation.quizNotAnsweredYet");
      const lesson = await this.lesson(lessonId, tx);
      this.assertAvailable(lesson.settings);
      if (
        !lesson.cooldown &&
        lesson.attemptsLimit !== null &&
        (progress.attempts ?? 0) >= lesson.attemptsLimit
      )
        throw new ConflictException("quizPoc.errors.attemptLimit");
      const lastCompletion = expired ? state.expiresAt : progress.updatedAt;
      if (
        !isQuizAccessAllowed(
          progress.attempts,
          lesson.attemptsLimit,
          lastCompletion,
          lesson.cooldown,
        )
      )
        throw new ConflictException("studentLessonView.validation.quizRetakeUnavailable");
      await tx
        .delete(studentQuestionAnswers)
        .where(
          and(
            eq(studentQuestionAnswers.studentId, userId),
            inArray(
              studentQuestionAnswers.questionId,
              tx
                .select({ id: questions.id })
                .from(questions)
                .where(eq(questions.lessonId, lessonId)),
            ),
          ),
        );
      await tx
        .update(studentLessonProgress)
        .set({
          quizAttemptState: null,
          quizScore: null,
          isQuizPassed: false,
          completedAt: null,
          completedQuestionCount: 0,
        })
        .where(this.condition(lessonId, userId));
      return true;
    });
  }
}
