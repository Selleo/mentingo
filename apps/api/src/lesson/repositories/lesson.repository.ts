import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, getTableColumns, ilike, isNull, or, sql } from "drizzle-orm";

import { DatabasePg, type UUIDType } from "src/common";
import {
  aiMentorStudentLessonProgress,
  chapters,
  courses,
  lessonResources,
  lessons,
  questions,
  quizAttempts,
  studentCourses,
  studentLessonProgress,
  studentChapterProgress,
} from "src/storage/schema";

import type { LessonTypes } from "../lesson.type";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type {
  AdminQuestionBody,
  EnrolledLessonsFilters,
  LessonResourceType,
  QuestionBody,
} from "src/lesson/lesson.schema";
import type * as schema from "src/storage/schema";

@Injectable()
export class LessonRepository {
  constructor(@Inject("DB") private readonly db: DatabasePg) {}

  async getLesson(id: UUIDType) {
    const [lesson] = await this.db.select().from(lessons).where(eq(lessons.id, id));
    return lesson;
  }

  async getHasLessonAccess(id: UUIDType, userId: UUIDType, isStudent: boolean) {
    if (!isStudent) return true;

    const [{ isSequenceEnabled, courseId }] = await this.db
      .select({
        isSequenceEnabled: sql<boolean>`(${courses.settings}->>'lessonSequenceEnabled')::boolean`,
        courseId: sql<UUIDType>`${courses.id}`,
      })
      .from(lessons)
      .leftJoin(chapters, eq(lessons.chapterId, chapters.id))
      .leftJoin(courses, eq(chapters.courseId, courses.id))
      .where(eq(lessons.id, id))
      .limit(1);

    if (!isSequenceEnabled) return true;

    const [{ currentChapterDisplayOrder, hasCompletedAllChapterLessons, hasCompletedAllLessons }] =
      await this.db
        .select({
          currentChapterDisplayOrder: sql<number>`${chapters.displayOrder}`,
          hasCompletedAllChapterLessons: sql<boolean>`
          ${lessons.displayOrder} <= (COALESCE(${studentChapterProgress.completedLessonCount}, 0) + 1)
        `,
          hasCompletedAllLessons: sql<boolean>`
          (
            SELECT bool_and(COALESCE(scp.completed_lesson_count, 0) = c.lesson_count)
            FROM ${chapters} c
            LEFT JOIN ${studentChapterProgress} scp
              ON scp.chapter_id = c.id AND scp.student_id = ${userId}
            WHERE c.course_id = ${courseId} AND c.display_order < ${chapters.displayOrder}
          )
        `,
        })
        .from(lessons)
        .leftJoin(chapters, eq(lessons.chapterId, chapters.id))
        .leftJoin(
          studentChapterProgress,
          and(
            eq(studentChapterProgress.chapterId, chapters.id),
            eq(studentChapterProgress.studentId, userId),
          ),
        )
        .where(eq(lessons.id, id));

    if (hasCompletedAllChapterLessons && currentChapterDisplayOrder === 1) return true;

    return hasCompletedAllLessons && hasCompletedAllChapterLessons;
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
        aiMentorDetails: sql<{
          minScore: number | null;
          maxScore: number | null;
          score: number | null;
          percentage: number | null;
          requiredScore: number | null;
        } | null>`
          json_build_object(
            'minScore', ${aiMentorStudentLessonProgress.minScore},
            'maxScore', ${aiMentorStudentLessonProgress.maxScore},
            'score', ${aiMentorStudentLessonProgress.score},
            'percentage', ${aiMentorStudentLessonProgress.percentage},
            'requiredScore', 
              CASE 
                WHEN ${aiMentorStudentLessonProgress.maxScore} > 0 
                THEN CAST(${aiMentorStudentLessonProgress.minScore} AS FLOAT) / CAST(${aiMentorStudentLessonProgress.maxScore} AS FLOAT) * 100
                ELSE 0 
              END
          )
        `,
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
      .leftJoin(
        aiMentorStudentLessonProgress,
        and(
          eq(studentLessonProgress.lessonId, lessons.id),
          eq(aiMentorStudentLessonProgress.studentLessonProgressId, studentLessonProgress.id),
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

  async getLessonResources(lessonId: UUIDType) {
    return await this.db
      .select({
        ...getTableColumns(lessonResources),
        type: sql<LessonResourceType>`${lessonResources.type}`,
      })
      .from(lessonResources)
      .where(eq(lessonResources.lessonId, lessonId))
      .orderBy(lessonResources.displayOrder);
  }

  async getEnrolledLessons(userId: UUIDType, filters: EnrolledLessonsFilters) {
    const conditions = [eq(studentCourses.studentId, userId)];

    if (filters.title) {
      conditions.push(ilike(lessons.title, `%${filters.title}%`));
    }

    if (filters.description) {
      conditions.push(ilike(lessons.description, `%${filters.description}%`));
    }

    if (filters.searchQuery) {
      conditions.push(
        or(
          ilike(lessons.title, `%${filters.searchQuery}%`),
          ilike(lessons.description, `%${filters.searchQuery}%`),
        )!,
      );
    }

    if (filters.lessonCompleted !== undefined) {
      if (filters.lessonCompleted) {
        conditions.push(sql`${studentLessonProgress.completedAt} IS NOT NULL`);
      } else {
        conditions.push(sql`${studentLessonProgress.completedAt} IS NULL`);
      }
    }

    return await this.db
      .select({
        id: lessons.id,
        title: lessons.title,
        type: sql<LessonTypes>`${lessons.type}`,
        description: sql<string | null>`${lessons.description}`,
        displayOrder: sql<number>`${lessons.displayOrder}`,
        lessonCompleted: sql<boolean>`${studentLessonProgress.completedAt} IS NOT NULL`,
        courseId: courses.id,
        courseTitle: courses.title,
        chapterId: chapters.id,
        chapterTitle: chapters.title,
        chapterDisplayOrder: sql<number>`${chapters.displayOrder}`,
      })
      .from(lessons)
      .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
      .innerJoin(courses, eq(courses.id, chapters.courseId))
      .innerJoin(studentCourses, eq(studentCourses.courseId, courses.id))
      .leftJoin(
        studentLessonProgress,
        and(
          eq(studentLessonProgress.lessonId, lessons.id),
          eq(studentLessonProgress.studentId, userId),
        ),
      )
      .where(and(...conditions))
      .orderBy(chapters.displayOrder, lessons.displayOrder);
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

  async getLessonResource(resourceId: UUIDType) {
    const [lessonResource] = await this.db
      .select()
      .from(lessonResources)
      .where(eq(lessonResources.id, resourceId));

    return lessonResource;
  }
}
