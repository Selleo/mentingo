import { Inject, Injectable } from "@nestjs/common";
import { COURSE_ENROLLMENT } from "@repo/shared";
import { and, eq, isNull, sql } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { LocalizationService } from "src/localization/localization.service";
import {
  chapters,
  courses,
  groups,
  groupUsers,
  lessons,
  studentCourses,
  studentLessonProgress,
  users,
} from "src/storage/schema";
import { USER_ROLES } from "src/user/schemas/userRoles";

import type { SupportedLanguages } from "@repo/shared";
import type { CurrentUser } from "src/common/types/current-user.type";

export interface StudentCourseReportRow {
  studentName: string;
  groupName: string | null;
  courseName: string;
  lessonCount: number;
  completedLessons: number;
  progressPercentage: number;
  quizResults: string;
}

@Injectable()
export class ReportRepository {
  constructor(
    @Inject("DB") private readonly db: DatabasePg,
    private readonly localizationService: LocalizationService,
  ) {}

  async getAllStudentCourseData(
    language: SupportedLanguages,
    currentUser: CurrentUser,
  ): Promise<StudentCourseReportRow[]> {
    const conditions = [
      eq(studentCourses.status, COURSE_ENROLLMENT.ENROLLED),
      eq(users.role, USER_ROLES.STUDENT),
      isNull(users.deletedAt),
    ];

    if (currentUser?.role === USER_ROLES.CONTENT_CREATOR) {
      conditions.push(eq(courses.authorId, currentUser.userId));
    }

    const reportData = await this.db
      .select({
        studentName: sql<string>`CONCAT(${users.firstName}, ' ', ${users.lastName})`,
        groupName: sql<string | null>`(
          SELECT STRING_AGG(DISTINCT g.name, ', ')
          FROM ${groups} g
          JOIN ${groupUsers} gu ON gu.group_id = g.id
          WHERE gu.user_id = ${users.id}
        )`,
        courseName: this.localizationService.getLocalizedSqlField(courses.title, language),
        lessonCount: sql<number>`(
          SELECT COALESCE(SUM(ch.lesson_count), 0)::int
          FROM ${chapters} ch
          WHERE ch.course_id = ${courses.id}
        )`,
        completedLessons: sql<number>`(
          SELECT COUNT(*)::int
          FROM ${studentLessonProgress} slp
          JOIN ${lessons} l ON slp.lesson_id = l.id
          JOIN ${chapters} ch ON l.chapter_id = ch.id
          WHERE slp.student_id = ${users.id}
            AND ch.course_id = ${courses.id}
            AND slp.completed_at IS NOT NULL
        )`,
        quizResults: sql<string>`COALESCE((
          SELECT STRING_AGG(
            'Quiz ' || quiz_lesson.quiz_index || ': ' || quiz_lesson.quiz_score || '%',
            ', '
            ORDER BY quiz_lesson.chapter_order, quiz_lesson.lesson_order
          )
          FROM (
            SELECT
              ROW_NUMBER() OVER (ORDER BY COALESCE(ch.display_order, 0), COALESCE(l.display_order, 0)) AS quiz_index,
              slp.quiz_score AS quiz_score,
              COALESCE(ch.display_order, 0) AS chapter_order,
              COALESCE(l.display_order, 0) AS lesson_order
            FROM ${studentLessonProgress} slp
            JOIN ${lessons} l ON slp.lesson_id = l.id
            JOIN ${chapters} ch ON l.chapter_id = ch.id
            WHERE slp.student_id = ${users.id}
              AND ch.course_id = ${courses.id}
              AND slp.quiz_score IS NOT NULL
          ) quiz_lesson
      ), '-')`,
      })
      .from(studentCourses)
      .innerJoin(users, eq(studentCourses.studentId, users.id))
      .innerJoin(courses, eq(studentCourses.courseId, courses.id))
      .where(and(...conditions));

    return reportData.map((row) => {
      const progressPercentage =
        row.lessonCount > 0 ? Math.round((row.completedLessons / row.lessonCount) * 100) : 0;

      return {
        studentName: row.studentName,
        groupName: row.groupName,
        courseName: row.courseName,
        lessonCount: row.lessonCount,
        completedLessons: row.completedLessons,
        progressPercentage,
        quizResults: row.quizResults,
      };
    });
  }
}
