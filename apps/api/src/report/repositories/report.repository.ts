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

  async getAllStudentCourseData(language: SupportedLanguages): Promise<StudentCourseReportRow[]> {
    // Get all enrolled students with their course data
    const rawData = await this.db
      .select({
        studentId: users.id,
        studentName: sql<string>`CONCAT(${users.firstName}, ' ', ${users.lastName})`,
        groupName: sql<string | null>`${groups.name}`,
        courseId: courses.id,
        courseName: this.localizationService.getLocalizedSqlField(courses.title, language),
      })
      .from(studentCourses)
      .innerJoin(users, eq(studentCourses.studentId, users.id))
      .innerJoin(courses, eq(studentCourses.courseId, courses.id))
      .leftJoin(groupUsers, eq(users.id, groupUsers.userId))
      .leftJoin(groups, eq(groupUsers.groupId, groups.id))
      .where(
        and(
          eq(studentCourses.status, COURSE_ENROLLMENT.ENROLLED),
          eq(users.role, USER_ROLES.STUDENT),
          isNull(users.deletedAt),
        ),
      );

    // For each student-course combination, get lesson counts and quiz results
    const reportData: StudentCourseReportRow[] = [];

    for (const row of rawData) {
      // Get total lesson count for this course
      const [lessonCountResult] = await this.db
        .select({
          totalLessons: sql<number>`COALESCE(SUM(${chapters.lessonCount}), 0)::int`,
        })
        .from(chapters)
        .where(eq(chapters.courseId, row.courseId));

      const totalLessons = lessonCountResult?.totalLessons ?? 0;

      // Get completed lessons count for this student in this course
      const [completedResult] = await this.db
        .select({
          completedLessons: sql<number>`COUNT(*)::int`,
        })
        .from(studentLessonProgress)
        .innerJoin(lessons, eq(studentLessonProgress.lessonId, lessons.id))
        .innerJoin(chapters, eq(lessons.chapterId, chapters.id))
        .where(
          and(
            eq(studentLessonProgress.studentId, row.studentId),
            eq(chapters.courseId, row.courseId),
            sql`${studentLessonProgress.completedAt} IS NOT NULL`,
          ),
        );

      const completedLessons = completedResult?.completedLessons ?? 0;

      // Get quiz results for this student in this course
      const quizData = await this.db
        .select({
          lessonTitle: this.localizationService.getLocalizedSqlField(lessons.title, language),
          quizScore: studentLessonProgress.quizScore,
        })
        .from(studentLessonProgress)
        .innerJoin(lessons, eq(studentLessonProgress.lessonId, lessons.id))
        .innerJoin(chapters, eq(lessons.chapterId, chapters.id))
        .innerJoin(courses, eq(chapters.courseId, courses.id))
        .where(
          and(
            eq(studentLessonProgress.studentId, row.studentId),
            eq(chapters.courseId, row.courseId),
            sql`${studentLessonProgress.quizScore} IS NOT NULL`,
          ),
        )
        .orderBy(lessons.displayOrder);

      // Format quiz results as "Quiz 1: X%, Quiz 2: Y%"
      const quizResults = quizData
        .map((q, index) => `Quiz ${index + 1}: ${q.quizScore}%`)
        .join(", ");

      const progressPercentage =
        totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

      reportData.push({
        studentName: row.studentName,
        groupName: row.groupName,
        courseName: row.courseName,
        lessonCount: totalLessons,
        completedLessons,
        progressPercentage,
        quizResults: quizResults || "-",
      });
    }

    return reportData;
  }
}
