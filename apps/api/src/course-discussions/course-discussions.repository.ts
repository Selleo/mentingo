import { Inject, Injectable } from "@nestjs/common";
import { SYSTEM_ROLE_SLUGS } from "@repo/shared";
import { and, desc, eq, isNull, sql } from "drizzle-orm";

import { DatabasePg, type UUIDType } from "src/common";
import {
  chapters,
  courseDiscussionThreads,
  courses,
  lessons,
  settings,
  studentCourses,
} from "src/storage/schema";

import type { CreateCourseDiscussionBody } from "./schemas/course-discussion.schema";
import type { CurrentUserType } from "src/common/types/current-user.type";

@Injectable()
export class CourseDiscussionsRepository {
  constructor(@Inject("DB") private readonly db: DatabasePg) {}

  async isCohortLearningEnabled() {
    const [row] = await this.db
      .select({
        cohortLearningEnabled: sql<boolean>`(${settings.settings}->>'cohortLearningEnabled')::boolean`,
      })
      .from(settings)
      .where(isNull(settings.userId))
      .limit(1);
    return row?.cohortLearningEnabled ?? false;
  }

  async canAccessCourse(courseId: UUIDType, user: CurrentUserType) {
    const [course] = await this.db
      .select({ authorId: courses.authorId })
      .from(courses)
      .where(eq(courses.id, courseId))
      .limit(1);
    if (!course) return false;
    if (user.roleSlugs.includes(SYSTEM_ROLE_SLUGS.ADMIN)) return true;
    if (course.authorId === user.userId) return true;
    const [enrollment] = await this.db
      .select({ id: studentCourses.id })
      .from(studentCourses)
      .where(
        and(
          eq(studentCourses.courseId, courseId),
          eq(studentCourses.studentId, user.userId),
          eq(studentCourses.status, "enrolled"),
        ),
      )
      .limit(1);
    return !!enrollment;
  }

  listThreads(courseId: UUIDType) {
    return this.db
      .select()
      .from(courseDiscussionThreads)
      .where(
        and(
          eq(courseDiscussionThreads.courseId, courseId),
          isNull(courseDiscussionThreads.lessonId),
        ),
      )
      .orderBy(desc(courseDiscussionThreads.lastActivityAt));
  }

  async lessonBelongsToCourse(courseId: UUIDType, lessonId: UUIDType) {
    const [row] = await this.db
      .select({ lessonId: lessons.id })
      .from(lessons)
      .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
      .innerJoin(courses, eq(courses.id, chapters.courseId))
      .where(and(eq(lessons.id, lessonId), eq(courses.id, courseId)))
      .limit(1);
    return !!row;
  }

  listLessonThreads(courseId: UUIDType, lessonId: UUIDType) {
    return this.db
      .select()
      .from(courseDiscussionThreads)
      .where(
        and(
          eq(courseDiscussionThreads.courseId, courseId),
          eq(courseDiscussionThreads.lessonId, lessonId),
        ),
      )
      .orderBy(desc(courseDiscussionThreads.lastActivityAt));
  }

  createThread(courseId: UUIDType, authorId: UUIDType, data: CreateCourseDiscussionBody) {
    return this.db
      .insert(courseDiscussionThreads)
      .values({
        courseId,
        lessonId: null,
        authorId,
        title: data.title,
        content: data.content,
        status: "visible",
        lastActivityAt: sql`CURRENT_TIMESTAMP`,
      })
      .returning();
  }

  createLessonThread(
    courseId: UUIDType,
    lessonId: UUIDType,
    authorId: UUIDType,
    data: CreateCourseDiscussionBody,
  ) {
    return this.db
      .insert(courseDiscussionThreads)
      .values({
        courseId,
        lessonId,
        authorId,
        title: data.title,
        content: data.content,
        status: "visible",
        lastActivityAt: sql`CURRENT_TIMESTAMP`,
      })
      .returning();
  }
}
