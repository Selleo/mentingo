import { Inject, Injectable } from "@nestjs/common";
import { COURSE_ENROLLMENT, COURSE_STATUSES, LESSON_TYPES, PERMISSIONS } from "@repo/shared";
import { and, count, eq, or, sql } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { hasPermission } from "src/common/permissions/permission.utils";
import { LocalizationService } from "src/localization/localization.service";
import { DB } from "src/storage/db/db.providers";
import { chapters, courses, lessons, studentCourses } from "src/storage/schema";

import { mcpStudentText } from "./mcp-student-text";

import type {
  McpStudentChapterRow,
  McpStudentLessonQuery,
  McpStudentLessonRow,
} from "./mcp-student-lesson.types";
import type { LessonTypes, SupportedLanguages } from "@repo/shared";
import type { UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";

/** Read-only curriculum access for MCP; management privileges never widen this access. */
@Injectable()
export class McpStudentLessonRepository {
  constructor(
    @Inject(DB) private readonly db: DatabasePg,
    private readonly localization: LocalizationService,
  ) {}

  private courseAccess(user: CurrentUserType) {
    const publicAccess = hasPermission(user.permissions, PERMISSIONS.COURSE_READ)
      ? eq(courses.status, COURSE_STATUSES.PUBLISHED)
      : sql`FALSE`;
    const enrolledAccess = hasPermission(user.permissions, PERMISSIONS.COURSE_READ_ASSIGNED)
      ? and(
          or(
            eq(courses.status, COURSE_STATUSES.PUBLISHED),
            eq(courses.status, COURSE_STATUSES.PRIVATE),
          ),
          sql`EXISTS (
            SELECT 1 FROM ${studentCourses}
            WHERE ${studentCourses.courseId} = ${courses.id}
              AND ${studentCourses.studentId} = ${user.userId}
              AND ${studentCourses.tenantId} = ${user.tenantId}
              AND ${studentCourses.status} = ${COURSE_ENROLLMENT.ENROLLED}
          )`,
        )
      : sql`FALSE`;
    return and(
      eq(courses.tenantId, user.tenantId),
      eq(chapters.tenantId, user.tenantId),
      eq(courses.isArchived, false),
      or(publicAccess, enrolledAccess),
    );
  }

  async listChapters(
    courseId: UUIDType,
    language: SupportedLanguages,
    user: CurrentUserType,
  ): Promise<McpStudentChapterRow[]> {
    return this.db
      .select({
        id: chapters.id,
        courseId: courses.id,
        title: this.localization.getLocalizedSqlField(chapters.title, language),
        displayOrder: chapters.displayOrder,
        lessonCount: chapters.lessonCount,
      })
      .from(chapters)
      .innerJoin(courses, eq(courses.id, chapters.courseId))
      .where(and(eq(courses.id, courseId), this.courseAccess(user)))
      .orderBy(chapters.displayOrder, chapters.id);
  }

  async listLessons(input: McpStudentLessonQuery, user: CurrentUserType) {
    const page = Math.min(10000, Math.max(1, Math.trunc(input.page ?? 1)));
    const pageSize = Math.min(25, Math.max(1, Math.trunc(input.pageSize ?? 10)));
    const title = this.localization.getLocalizedSqlField(lessons.title, input.language);
    const description = this.localization.getLocalizedSqlField(lessons.description, input.language);
    const query = input.query?.trim().slice(0, 200).toLocaleLowerCase();
    const conditions = and(
      this.courseAccess(user),
      eq(lessons.tenantId, user.tenantId),
      input.courseId ? eq(courses.id, input.courseId) : undefined,
      input.chapterId ? eq(chapters.id, input.chapterId) : undefined,
      input.lessonId ? eq(lessons.id, input.lessonId) : undefined,
    );
    const rows = () =>
      this.db
        .select({
          id: lessons.id,
          title,
          type: sql<LessonTypes>`${lessons.type}`,
          displayOrder: lessons.displayOrder,
          chapterId: chapters.id,
          chapterTitle: this.localization.getLocalizedSqlField(chapters.title, input.language),
          courseId: courses.id,
          courseTitle: this.localization.getLocalizedSqlField(courses.title, input.language),
          description: sql<
            string | null
          >`CASE WHEN ${lessons.type} = ${LESSON_TYPES.CONTENT} THEN ${description} ELSE NULL END`,
        })
        .from(lessons)
        .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
        .innerJoin(courses, eq(courses.id, chapters.courseId))
        .where(conditions)
        .orderBy(courses.id, chapters.displayOrder, lessons.displayOrder, lessons.id);
    if (query) {
      // Authorize in SQL, then match the same parsed text that readers receive.
      // Batches bound memory and avoid regex HTML parsing leaking hidden attribute matches.
      const data: McpStudentLessonRow[] = [];
      const first = (page - 1) * pageSize;
      const batchSize = 100;
      let totalItems = 0;
      for (let offset = 0; ; offset += batchSize) {
        const batch = await rows().limit(batchSize).offset(offset);
        for (const row of batch) {
          const titleText = mcpStudentText(row.title).toLocaleLowerCase();
          const bodyText =
            row.type === LESSON_TYPES.CONTENT
              ? mcpStudentText(row.description).toLocaleLowerCase()
              : "";
          if (!titleText.includes(query) && !bodyText.includes(query)) continue;
          if (totalItems >= first && data.length < pageSize) data.push(row);
          totalItems++;
        }
        if (batch.length < batchSize) break;
      }
      return { data, pagination: { page, perPage: pageSize, totalItems } };
    }
    const data: McpStudentLessonRow[] = await rows()
      .limit(pageSize)
      .offset((page - 1) * pageSize);
    const [{ totalItems }] = await this.db
      .select({ totalItems: count() })
      .from(lessons)
      .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
      .innerJoin(courses, eq(courses.id, chapters.courseId))
      .where(conditions);
    return { data, pagination: { page, perPage: pageSize, totalItems } };
  }
}
