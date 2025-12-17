import { Inject, Injectable } from "@nestjs/common";
import { COURSE_ENROLLMENT } from "@repo/shared";
import { and, desc, eq, getTableColumns, type SQL, sql } from "drizzle-orm";

import { DatabasePg, type UUIDType } from "src/common";
import { LocalizationService } from "src/localization/localization.service";
import {
  aiMentorLessons,
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
import type { SupportedLanguages } from "@repo/shared";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type {
  AdminQuestionBody,
  EnrolledLessonsFilters,
  LessonResourceType,
} from "src/lesson/lesson.schema";
import type * as schema from "src/storage/schema";

@Injectable()
export class LessonRepository {
  constructor(
    @Inject("DB") private readonly db: DatabasePg,
    private readonly localizationService: LocalizationService,
  ) {}

  async getLesson(id: UUIDType, language: SupportedLanguages) {
    const [lesson] = await this.db
      .select({
        ...getTableColumns(lessons),
        title: this.localizationService.getLocalizedSqlField(lessons.title, language),
        description: this.localizationService.getLocalizedSqlField(lessons.description, language),
      })
      .from(lessons)
      .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
      .innerJoin(courses, eq(courses.id, chapters.courseId))
      .where(eq(lessons.id, id));
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

  async getLessonDetails(id: UUIDType, userId: UUIDType, language?: SupportedLanguages) {
    const [lesson] = await this.db
      .select({
        id: lessons.id,
        type: sql<LessonTypes>`${lessons.type}`,
        title: this.localizationService.getLocalizedSqlField(lessons.title, language),
        description: this.localizationService.getLocalizedSqlField(lessons.description, language),
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
        aiMentor: sql<{ name: string; avatarReferenceUrl: string } | null>`
          CASE
            WHEN ai_mentor_lessons.name IS NOT NULL THEN
              json_build_object(
                'name', ai_mentor_lessons.name,
                'avatarReferenceUrl', ai_mentor_lessons.avatar_reference
              )
            ELSE NULL
          END
        `,
        isExternal: sql<boolean>`${lessons.isExternal}`,
        isFreemium: sql<boolean>`${chapters.isFreemium}`,
        isEnrolled: sql<boolean>`CASE WHEN ${studentCourses.status} = ${COURSE_ENROLLMENT.ENROLLED} THEN TRUE ELSE FALSE END`,
        studentCourses: sql<string>`CASE WHEN ${studentCourses.status} = ${COURSE_ENROLLMENT.ENROLLED} THEN ${studentCourses.id} ELSE NULL END`,
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
      .leftJoin(aiMentorLessons, eq(aiMentorLessons.lessonId, id))
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
          eq(studentCourses.status, COURSE_ENROLLMENT.ENROLLED),
        ),
      )
      .leftJoin(
        aiMentorStudentLessonProgress,
        and(
          eq(studentLessonProgress.lessonId, lessons.id),
          eq(aiMentorStudentLessonProgress.studentLessonProgressId, studentLessonProgress.id),
        ),
      )
      .innerJoin(courses, eq(courses.id, chapters.courseId))
      .where(eq(lessons.id, id));

    return lesson;
  }

  async getLessonsByChapterId(chapterId: UUIDType, language: SupportedLanguages) {
    return this.db
      .select({
        id: lessons.id,
        title: this.localizationService.getLocalizedSqlField(lessons.title, language),
        type: sql<LessonTypes>`${lessons.type}`,
        description: this.localizationService.getLocalizedSqlField(lessons.description, language),
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
                  ${this.localizationService.getLocalizedSqlField(
                    questions.title,
                    language,
                  )} AS title,
                  ${this.localizationService.getLocalizedSqlField(
                    questions.description,
                    language,
                  )} AS description,
                  ${questions.type} AS type,
                  ${questions.photoS3Key} AS photoS3Key,
                  ${this.localizationService.getLocalizedSqlField(
                    questions.solutionExplanation,
                    language,
                  )} AS solutionExplanation,
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
      .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
      .innerJoin(courses, eq(courses.id, chapters.courseId))
      .where(eq(lessons.chapterId, chapterId))
      .orderBy(lessons.displayOrder);
  }

  async getLessonSettings(lessonId: UUIDType, language?: SupportedLanguages) {
    const [lessonSettings] = await this.db
      .select({
        id: lessons.id,
        title: this.localizationService.getLocalizedSqlField(lessons.title, language),
        type: sql<LessonTypes>`${lessons.type}`,
        thresholdScore: sql<number | null>`${lessons.thresholdScore}`,
        attemptsLimit: sql<number | null>`${lessons.attemptsLimit}`,
        quizCooldownInHours: sql<number | null>`${lessons.quizCooldownInHours}`,
      })
      .from(lessons)
      .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
      .innerJoin(courses, eq(courses.id, chapters.courseId))
      .where(eq(lessons.id, lessonId))
      .limit(1);
    return lessonSettings;
  }

  async getLessonsProgressByCourseId(
    courseId: UUIDType,
    userId: UUIDType,
    trx?: PostgresJsDatabase<typeof schema>,
  ) {
    const dbInstance = trx ?? this.db;

    return dbInstance
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
        isAssigned: sql<boolean>`CASE WHEN ${studentCourses.status} IS NOT NULL THEN TRUE ELSE FALSE END`,
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
    return this.db
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
    return this.db
      .select({
        ...getTableColumns(lessonResources),
        type: sql<LessonResourceType>`${lessonResources.type}`,
      })
      .from(lessonResources)
      .where(eq(lessonResources.lessonId, lessonId))
      .orderBy(lessonResources.displayOrder);
  }

  async getResource(resourceId: UUIDType) {
    const [resource] = await this.db
      .select()
      .from(lessonResources)
      .where(eq(lessonResources.id, resourceId));

    return resource;
  }

  async getEnrolledLessons(
    userId: UUIDType,
    filters: EnrolledLessonsFilters,
    language: SupportedLanguages,
  ) {
    const conditions = [
      eq(studentCourses.studentId, userId),
      eq(studentCourses.status, COURSE_ENROLLMENT.ENROLLED),
    ];

    if (filters.title) {
      conditions.push(
        sql`EXISTS (SELECT 1 FROM jsonb_each_text(${
          lessons.title
        }) AS t(k, v) WHERE v ILIKE ${`%${filters.title}%`})`,
      );
    }

    if (filters.description) {
      conditions.push(
        sql`EXISTS (SELECT 1 FROM jsonb_each_text(${
          lessons.description
        }) AS t(k, v) WHERE v ILIKE ${`%${filters.description}%`})`,
      );
    }

    if (filters.searchQuery) {
      conditions.push(
        sql`EXISTS (SELECT 1 FROM jsonb_each_text(${
          lessons.title
        }) AS t(k, v) WHERE v ILIKE ${`%${filters.searchQuery}%`}) OR EXISTS (SELECT 1 FROM jsonb_each_text(${
          lessons.description
        }) AS t(k, v) WHERE v ILIKE ${`%${filters.searchQuery}%`})`,
      );
    }

    if (filters.lessonCompleted !== undefined) {
      if (filters.lessonCompleted) {
        conditions.push(sql`${studentLessonProgress.completedAt} IS NOT NULL`);
      } else {
        conditions.push(sql`${studentLessonProgress.completedAt} IS NULL`);
      }
    }

    return this.db
      .select({
        id: lessons.id,
        title: this.localizationService.getLocalizedSqlField(lessons.title, language),
        type: sql<LessonTypes>`${lessons.type}`,
        description: this.localizationService.getLocalizedSqlField(lessons.description, language),
        displayOrder: sql<number>`${lessons.displayOrder}`,
        lessonCompleted: sql<boolean>`${studentLessonProgress.completedAt} IS NOT NULL`,
        courseId: courses.id,
        courseTitle: this.localizationService.getLocalizedSqlField(courses.title, language),
        chapterId: chapters.id,
        chapterTitle: this.localizationService.getLocalizedSqlField(chapters.title, language),
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

  async getLessonProgress(lessonId: UUIDType, userId: UUIDType, conditions?: SQL[]) {
    const [progress] = await this.db
      .select({
        ...getTableColumns(studentLessonProgress),
        languageAnswered: sql<SupportedLanguages>`${studentLessonProgress.languageAnswered}`,
      })
      .from(studentLessonProgress)
      .where(
        and(
          eq(studentLessonProgress.lessonId, lessonId),
          eq(studentLessonProgress.studentId, userId),
          ...(conditions ?? []),
        ),
      );

    return progress;
  }
}
