import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, isNull, sql } from "drizzle-orm";

import { DatabasePg, type UUIDType } from "src/common";
import {
  chapters,
  courses,
  lessons,
  questions,
  quizAttempts,
  studentCourses,
  studentLessonProgress,
} from "src/storage/schema";

import type { LessonTypes } from "../lesson.type";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { AdminQuestionBody, QuestionBody } from "src/lesson/lesson.schema";
import type * as schema from "src/storage/schema";

@Injectable()
export class LessonRepository {
  constructor(@Inject("DB") private readonly db: DatabasePg) {}

  async getLesson(id: UUIDType) {
    const [lesson] = await this.db.select().from(lessons).where(eq(lessons.id, id));
    return lesson;
  }

  async getLessonDetails(id: UUIDType, userId: UUIDType) {
    const [lesson] = await this.db
      .select({
        id: lessons.id,
        type: sql<LessonTypes>`${lessons.type}`,
        title: lessons.title,
        description: sql<string>`${lessons.description}`,
        fileUrl: lessons.fileS3Key,
        fileType: lessons.fileType,
        thresholdScore: sql<number | null>`${lessons.thresholdScore}`,
        attemptsLimit: sql<number | null>`${lessons.attemptsLimit}`,
        quizCooldownInHours: sql<number | null>`${lessons.quizCooldownInHours}`,
        displayOrder: sql<number>`${lessons.displayOrder}`,
        lessonCompleted: sql<boolean>`${studentLessonProgress.completedAt} IS NOT NULL`,
        quizScore: sql<number | null>`${studentLessonProgress.quizScore}`,
        updatedAt: studentLessonProgress.updatedAt,
        isQuizPassed: sql<boolean | null>`${studentLessonProgress.isQuizPassed}`,
        attempts: sql<number | null>`${studentLessonProgress.attempts}`,
        isExternal: sql<boolean>`${lessons.isExternal}`,
        isFreemium: sql<boolean>`${chapters.isFreemium}`,
        isEnrolled: sql<boolean>`CASE WHEN ${studentCourses.id} IS NULL THEN FALSE ELSE TRUE END`,
        studentCourses: studentCourses.id,
        nextLessonId: sql<string | null>`
          COALESCE(
            (
              SELECT l2.id
              FROM ${lessons} l2
              JOIN ${chapters} c ON c.id = l2.chapter_id
              LEFT JOIN ${studentLessonProgress} slp ON slp.lesson_id = l2.id AND slp.student_id = ${userId}
              WHERE c.course_id = ${chapters.courseId}
                AND l2.id != ${lessons.id}
                AND slp.completed_at IS NULL
              ORDER BY c.display_order, l2.display_order
              LIMIT 1
            ),
            NULL
          )
        `,
      })
      .from(lessons)
      .leftJoin(chapters, eq(chapters.id, lessons.chapterId))
      .leftJoin(
        studentCourses,
        and(eq(studentCourses.courseId, chapters.courseId), eq(studentCourses.studentId, userId)),
      )
      .leftJoin(
        studentLessonProgress,
        and(
          eq(studentLessonProgress.lessonId, lessons.id),
          eq(studentLessonProgress.studentId, userId),
        ),
      )
      .where(eq(lessons.id, id));

    return lesson;
  }

  async getLessonsByChapterId(chapterId: UUIDType) {
    return this.db
      .select({
        id: lessons.id,
        title: lessons.title,
        type: sql<LessonTypes>`${lessons.type}`,
        description: sql<string>`${lessons.description}`,
        fileS3Key: sql<string | undefined>`${lessons.fileS3Key}`,
        fileType: sql<string | undefined>`${lessons.fileType}`,
        displayOrder: sql<number>`${lessons.displayOrder}`,
        questions: sql<AdminQuestionBody[]>`
          COALESCE(
            (
              SELECT json_agg(questions_data)
              FROM (
                SELECT
                  ${questions.id} AS id,
                  ${questions.title} AS title,
                  ${questions.description} AS description,
                  ${questions.type} AS type,
                  ${questions.photoS3Key} AS photoS3Key,
                  ${questions.solutionExplanation} AS solutionExplanation,
                  ${questions.displayOrder} AS displayOrder
                FROM ${questions}
                WHERE ${lessons.id} = ${questions.lessonId}
                ORDER BY ${questions.displayOrder}
              ) AS questions_data
            ), 
            '[]'::json
          )
        `,
      })
      .from(lessons)
      .where(eq(lessons.chapterId, chapterId))
      .orderBy(lessons.displayOrder);
  }

  async getLessonsForChapter(chapterId: UUIDType) {
    return this.db
      .select({
        title: lessons.title,
        type: lessons.type,
        displayOrder: sql<number>`${lessons.displayOrder}`,
        questions: sql<QuestionBody[]>`
          COALESCE(
            (
              SELECT json_agg(questions_data)
              FROM (
                SELECT
                  ${questions.id} AS id,
                  ${questions.title} AS title,
                  ${questions.description} AS description,
                  ${questions.type} AS type,
                  ${questions.photoS3Key} AS photoS3Key,
                  ${questions.solutionExplanation} AS solutionExplanation,
                  ${questions.displayOrder} AS displayOrder,
                FROM ${questions}
                WHERE ${lessons.id} = ${questions.lessonId}
                ORDER BY ${questions.displayOrder}
              ) AS questions_data
            ), 
            '[]'::json
          )
        `,
      })
      .from(lessons)
      .where(eq(lessons.chapterId, chapterId))
      .orderBy(lessons.displayOrder);
  }

  async getLessonSettings(lessonId: UUIDType) {
    const [lessonSettings] = await this.db
      .select({
        id: lessons.id,
        title: sql<string>`${lessons.title}`,
        type: sql<LessonTypes>`${lessons.type}`,
        thresholdScore: sql<number | null>`${lessons.thresholdScore}`,
        attemptsLimit: sql<number | null>`${lessons.attemptsLimit}`,
        quizCooldownInHours: sql<number | null>`${lessons.quizCooldownInHours}`,
      })
      .from(lessons)
      .where(eq(lessons.id, lessonId))
      .limit(1);
    return lessonSettings;
  }

  async completeQuiz(
    chapterId: UUIDType,
    lessonId: UUIDType,
    userId: UUIDType,
    completedQuestionCount: number,
    quizScore: number,
    trx: PostgresJsDatabase<typeof schema>,
  ) {
    return trx
      .insert(studentLessonProgress)
      .values({
        studentId: userId,
        lessonId,
        chapterId,
        completedAt: sql`now()`,
        completedQuestionCount,
        quizScore,
      })
      .onConflictDoUpdate({
        target: [
          studentLessonProgress.studentId,
          studentLessonProgress.lessonId,
          studentLessonProgress.chapterId,
        ],
        set: {
          completedAt: sql`now()`,
          completedQuestionCount,
          quizScore,
        },
      })
      .returning();
  }

  async getLastInteractedOrNextLessonItemForUser(userId: UUIDType) {
    const [lastLesson] = await this.db
      .select({
        id: sql<string>`${studentLessonProgress.lessonId}`,
        chapterId: sql<string>`${chapters.id}`,
        courseId: sql<string>`${chapters.courseId}`,
        courseTitle: sql<string>`${courses.title}`,
        courseDescription: sql<string>`${courses.description}`,
      })
      .from(studentLessonProgress)
      .leftJoin(chapters, eq(chapters.id, studentLessonProgress.chapterId))
      .leftJoin(courses, eq(courses.id, chapters.courseId))
      .where(
        and(eq(studentLessonProgress.studentId, userId), isNull(studentLessonProgress.completedAt)),
      )
      .orderBy(desc(studentLessonProgress.createdAt))
      .limit(1);

    return lastLesson;
  }

  async getLessonsProgressByCourseId(
    courseId: UUIDType,
    userId: UUIDType,
    trx?: PostgresJsDatabase<typeof schema>,
  ) {
    const dbInstance = trx ?? this.db;

    return await dbInstance
      .select({
        lessonId: studentLessonProgress.lessonId,
        completedLessonCount: studentLessonProgress.completedQuestionCount,
        quizCompleted: studentLessonProgress.completedAt,
        quizScore: studentLessonProgress.quizScore,
      })
      .from(studentLessonProgress)
      .leftJoin(lessons, eq(studentLessonProgress.lessonId, lessons.id))
      .leftJoin(chapters, eq(lessons.chapterId, chapters.id))
      .where(and(eq(chapters.courseId, courseId), eq(studentLessonProgress.studentId, userId)));
  }

  async checkLessonAssignment(id: UUIDType, userId: UUIDType) {
    return this.db
      .select({
        isAssigned: sql<boolean>`CASE WHEN ${studentCourses.id} IS NOT NULL THEN TRUE ELSE FALSE END`,
        isFreemium: sql<boolean>`CASE WHEN ${chapters.isFreemium} THEN TRUE ELSE FALSE END`,
        updatedAt: studentLessonProgress.updatedAt,
        attempts: sql<number | null>`${studentLessonProgress.attempts}`,
        isQuizPassed: sql<boolean | null>`${studentLessonProgress.isQuizPassed}`,
        lessonIsCompleted: sql<boolean>`CASE WHEN ${studentLessonProgress.completedAt} IS NOT NULL THEN TRUE ELSE FALSE END`,
        chapterId: sql<string>`${chapters.id}`,
        courseId: sql<string>`${chapters.courseId}`,
      })
      .from(lessons)
      .leftJoin(
        studentLessonProgress,
        and(
          eq(studentLessonProgress.lessonId, lessons.id),
          eq(studentLessonProgress.studentId, userId),
        ),
      )
      .leftJoin(chapters, eq(lessons.chapterId, chapters.id))
      .leftJoin(
        studentCourses,
        and(eq(studentCourses.courseId, chapters.courseId), eq(studentCourses.studentId, userId)),
      )
      .where(eq(lessons.id, id));
  }

  async getQuizResult(lessonId: UUIDType, quizScore: number, userId: UUIDType) {
    return await this.db
      .select({
        score: sql<number>`${quizAttempts.score}`,
        correctAnswerCount: sql<number>`${quizAttempts.correctAnswers}`,
        wrongAnswerCount: sql<number>`${quizAttempts.wrongAnswers}`,
      })
      .from(quizAttempts)
      .where(
        and(
          eq(quizAttempts.lessonId, lessonId),
          eq(quizAttempts.userId, userId),
          eq(quizAttempts.score, quizScore),
        ),
      )
      .orderBy(desc(quizAttempts.createdAt))
      .limit(1);
  }

  //   async retireQuizProgress(
  //     courseId: UUIDType,
  //     lessonId: UUIDType,
  //     userId: UUIDType,
  //     trx?: PostgresJsDatabase<typeof schema>,
  //   ) {
  //     const dbInstance = trx ?? this.db;

  //     return await dbInstance
  //       .update(studentLessonsProgress)
  //       .set({ quizCompleted: false })
  //       .where(
  //         and(
  //           eq(studentLessonsProgress.studentId, userId),
  //           eq(studentLessonsProgress.lessonId, lessonId),
  //           eq(studentLessonsProgress.courseId, courseId),
  //         ),
  //       );
  //   }
}
