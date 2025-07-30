import { Inject, Injectable } from "@nestjs/common";
import { and, eq, sql } from "drizzle-orm";

import { DatabasePg, type UUIDType } from "src/common";
import { chapters, lessons, studentChapterProgress, studentCourses } from "src/storage/schema";
import { PROGRESS_STATUSES } from "src/utils/types/progress.type";

import type { ProgressStatus } from "src/utils/types/progress.type";

@Injectable()
export class ChapterRepository {
  constructor(@Inject("DB") private readonly db: DatabasePg) {}

  async checkChapterAssignment(id: UUIDType, userId: UUIDType) {
    return this.db
      .select({
        id: chapters.id,
        isFreemium: chapters.isFreemium,
        isAssigned: sql<boolean>`CASE WHEN ${studentCourses.id} IS NOT NULL THEN TRUE ELSE FALSE END`,
      })
      .from(chapters)
      .leftJoin(
        studentCourses,
        and(eq(studentCourses.courseId, chapters.courseId), eq(studentCourses.studentId, userId)),
      )
      .where(eq(chapters.id, id));
  }

  async getChapterForUser(id: UUIDType, userId: UUIDType) {
    const [chapter] = await this.db
      .select({
        displayOrder: sql<number>`${lessons.displayOrder}`,
        id: chapters.id,
        title: chapters.title,
        isFreemium: chapters.isFreemium,
        enrolled: sql<boolean>`CASE WHEN ${studentCourses.id} IS NOT NULL THEN true ELSE false END`,
        lessonCount: chapters.lessonCount,
        completedLessonCount: sql<number>`COALESCE(${studentChapterProgress.completedLessonCount}, 0)`,
        progress: sql<ProgressStatus>`
          CASE ${studentChapterProgress.completedAt} IS NOT NULL
            THEN ${PROGRESS_STATUSES.COMPLETED}
            WHEN ${studentChapterProgress.completedAt} IS NULL AND ${studentChapterProgress.completedLessonCount} < 0
              THEN ${PROGRESS_STATUSES.IN_PROGRESS}
            ELSE ${PROGRESS_STATUSES.NOT_STARTED}`,
      })
      .from(chapters)
      .leftJoin(
        studentChapterProgress,
        and(
          eq(studentChapterProgress.courseId, chapters.courseId),
          eq(studentChapterProgress.chapterId, chapters.id),
          eq(studentChapterProgress.studentId, userId),
        ),
      )
      .leftJoin(
        studentCourses,
        and(eq(studentCourses.courseId, chapters.courseId), eq(studentCourses.studentId, userId)),
      )
      .where(eq(chapters.id, id));

    return chapter;
  }

  async getChapter(id: UUIDType) {
    const [chapter] = await this.db
      .select({
        id: chapters.id,
        title: chapters.title,
        isFreemium: chapters.isFreemium,
        itemsCount: chapters.lessonCount,
      })
      .from(chapters)
      .where(eq(chapters.id, id));

    return chapter;
  }
}
