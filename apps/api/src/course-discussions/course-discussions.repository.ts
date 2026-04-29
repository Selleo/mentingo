import { Inject, Injectable } from "@nestjs/common";
import { SYSTEM_ROLE_SLUGS } from "@repo/shared";
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";

import { DatabasePg, type UUIDType } from "src/common";
import {
  chapters,
  courseDiscussionThreads,
  courseDiscussionComments,
  courses,
  lessons,
  settings,
  studentCourses,
} from "src/storage/schema";

import type {
  CreateCourseDiscussionBody,
  CreateCourseDiscussionCommentBody,
  ModerateCourseDiscussionBody,
  UpdateCourseDiscussionBody,
} from "./schemas/course-discussion.schema";
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

  async canModerateCourse(courseId: UUIDType, user: CurrentUserType) {
    const [course] = await this.db
      .select({ authorId: courses.authorId })
      .from(courses)
      .where(eq(courses.id, courseId))
      .limit(1);
    if (!course) return false;
    return user.roleSlugs.includes(SYSTEM_ROLE_SLUGS.ADMIN) || course.authorId === user.userId;
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

  async findThreadById(threadId: UUIDType) {
    const [thread] = await this.db
      .select()
      .from(courseDiscussionThreads)
      .where(eq(courseDiscussionThreads.id, threadId))
      .limit(1);
    return thread ?? null;
  }

  async getThreadDetail(threadId: UUIDType) {
    const thread = await this.findThreadById(threadId);
    if (!thread) return null;
    const comments = await this.db
      .select()
      .from(courseDiscussionComments)
      .where(eq(courseDiscussionComments.threadId, threadId))
      .orderBy(asc(courseDiscussionComments.createdAt));
    return { ...thread, comments };
  }

  async getThreadDetailForUser(threadId: UUIDType, canModerate: boolean) {
    const detail = await this.getThreadDetail(threadId);
    if (!detail) return null;
    return canModerate ? detail : { ...detail, comments: detail.comments.map((c) => c) };
  }

  async updateThread(threadId: UUIDType, data: UpdateCourseDiscussionBody) {
    const values: Record<string, unknown> = { updatedAt: sql`CURRENT_TIMESTAMP` };
    if (data.title !== undefined) values.title = data.title;
    if (data.content !== undefined) values.content = data.content;
    const [row] = await this.db
      .update(courseDiscussionThreads)
      .set(values)
      .where(eq(courseDiscussionThreads.id, threadId))
      .returning();
    return row ?? null;
  }

  async softDeleteThread(threadId: UUIDType, userId: UUIDType) {
    const [row] = await this.db
      .update(courseDiscussionThreads)
      .set({
        status: "deleted_by_author",
        deletedAt: sql`CURRENT_TIMESTAMP`,
        deletedById: userId,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where(eq(courseDiscussionThreads.id, threadId))
      .returning();
    return row ?? null;
  }

  createComment(threadId: UUIDType, authorId: UUIDType, data: CreateCourseDiscussionCommentBody) {
    return this.db
      .insert(courseDiscussionComments)
      .values({ threadId, authorId, content: data.content, status: "visible" })
      .returning();
  }

  async updateThreadLastActivity(threadId: UUIDType) {
    await this.db
      .update(courseDiscussionThreads)
      .set({ lastActivityAt: sql`CURRENT_TIMESTAMP`, updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(courseDiscussionThreads.id, threadId));
  }

  async findCommentById(commentId: UUIDType) {
    const [comment] = await this.db
      .select()
      .from(courseDiscussionComments)
      .where(eq(courseDiscussionComments.id, commentId))
      .limit(1);
    return comment ?? null;
  }

  async updateComment(commentId: UUIDType, data: { content: string }) {
    const [row] = await this.db
      .update(courseDiscussionComments)
      .set({ content: data.content, updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(courseDiscussionComments.id, commentId))
      .returning();
    return row ?? null;
  }

  async softDeleteComment(commentId: UUIDType, userId: UUIDType) {
    const [row] = await this.db
      .update(courseDiscussionComments)
      .set({
        status: "deleted_by_author",
        deletedAt: sql`CURRENT_TIMESTAMP`,
        deletedById: userId,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where(eq(courseDiscussionComments.id, commentId))
      .returning();
    return row ?? null;
  }

  async moderateThread(threadId: UUIDType, userId: UUIDType, data: ModerateCourseDiscussionBody) {
    const [row] = await this.db
      .update(courseDiscussionThreads)
      .set(
        data.hidden
          ? {
              status: "hidden_by_staff",
              hiddenAt: sql`CURRENT_TIMESTAMP`,
              hiddenById: userId,
              updatedAt: sql`CURRENT_TIMESTAMP`,
            }
          : {
              status: "visible",
              hiddenAt: null,
              hiddenById: null,
              updatedAt: sql`CURRENT_TIMESTAMP`,
            },
      )
      .where(eq(courseDiscussionThreads.id, threadId))
      .returning();
    return row ?? null;
  }

  async moderateComment(commentId: UUIDType, userId: UUIDType, data: ModerateCourseDiscussionBody) {
    const [row] = await this.db
      .update(courseDiscussionComments)
      .set(
        data.hidden
          ? {
              status: "hidden_by_staff",
              hiddenAt: sql`CURRENT_TIMESTAMP`,
              hiddenById: userId,
              updatedAt: sql`CURRENT_TIMESTAMP`,
            }
          : {
              status: "visible",
              hiddenAt: null,
              hiddenById: null,
              updatedAt: sql`CURRENT_TIMESTAMP`,
            },
      )
      .where(eq(courseDiscussionComments.id, commentId))
      .returning();
    return row ?? null;
  }
}
