import { Inject, Injectable } from "@nestjs/common";
import { COURSE_ENROLLMENT } from "@repo/shared";
import { and, countDistinct, eq, ne, sql } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { addPagination, DEFAULT_PAGE_SIZE } from "src/common/pagination";
import {
  chapters,
  courses,
  groups,
  groupUsers,
  lessonLearningTime,
  lessons,
  studentCourses,
  users,
} from "src/storage/schema";

import type { SQL } from "drizzle-orm";
import type { UUIDType } from "src/common";

@Injectable()
export class LearningTimeRepository {
  constructor(@Inject("DB") private readonly db: DatabasePg) {}

  async addLearningTime(userId: UUIDType, lessonId: UUIDType, courseId: UUIDType, seconds: number) {
    await this.db
      .insert(lessonLearningTime)
      .values({
        userId,
        lessonId,
        courseId,
        totalSeconds: seconds,
      })
      .onConflictDoUpdate({
        target: [lessonLearningTime.userId, lessonLearningTime.lessonId],
        set: {
          totalSeconds: sql`${lessonLearningTime.totalSeconds} + ${seconds}`,
        },
      });
  }

  async getCourseIdByLessonId(lessonId: UUIDType): Promise<UUIDType | null> {
    const [result] = await this.db
      .select({ courseId: chapters.courseId })
      .from(lessons)
      .innerJoin(chapters, eq(lessons.chapterId, chapters.id))
      .where(eq(lessons.id, lessonId));

    return result?.courseId ?? null;
  }

  async getLearningTimeForUser(userId: UUIDType, lessonId: UUIDType) {
    const [result] = await this.db
      .select({
        totalSeconds: lessonLearningTime.totalSeconds,
      })
      .from(lessonLearningTime)
      .where(and(eq(lessonLearningTime.userId, userId), eq(lessonLearningTime.lessonId, lessonId)));

    return result?.totalSeconds ?? 0;
  }

  async getLearningTimeForCourse(courseId: UUIDType) {
    return this.db
      .select({
        lessonId: lessonLearningTime.lessonId,
        lessonTitle: sql<string>`${lessons.title}->>${courses.baseLanguage}`,
        userId: lessonLearningTime.userId,
        userFirstName: users.firstName,
        userLastName: users.lastName,
        userEmail: users.email,
        totalSeconds: lessonLearningTime.totalSeconds,
      })
      .from(lessonLearningTime)
      .innerJoin(users, eq(lessonLearningTime.userId, users.id))
      .innerJoin(lessons, eq(lessonLearningTime.lessonId, lessons.id))
      .innerJoin(courses, eq(lessonLearningTime.courseId, courses.id))
      .where(eq(lessonLearningTime.courseId, courseId));
  }

  async getAverageLearningTimePerLesson(courseId: UUIDType, conditions: SQL<unknown>[] = []) {
    return this.db
      .select({
        lessonId: lessonLearningTime.lessonId,
        lessonTitle: sql<string>`${lessons.title}->>${courses.baseLanguage}`,
        averageSeconds: sql<number>`ROUND(AVG(${lessonLearningTime.totalSeconds}))::INTEGER`,
        totalUsers: sql<number>`COUNT(DISTINCT ${lessonLearningTime.userId})::INTEGER`,
        totalSeconds: sql<number>`SUM(${lessonLearningTime.totalSeconds})::INTEGER`,
      })
      .from(lessonLearningTime)
      .innerJoin(lessons, eq(lessonLearningTime.lessonId, lessons.id))
      .innerJoin(courses, eq(lessonLearningTime.courseId, courses.id))
      .where(and(eq(lessonLearningTime.courseId, courseId), ...conditions))
      .groupBy(
        lessonLearningTime.lessonId,
        lessons.title,
        lessons.displayOrder,
        courses.baseLanguage,
      )
      .orderBy(lessons.displayOrder);
  }

  async getTotalLearningTimePerStudent(courseId: UUIDType, conditions: SQL<unknown>[] = []) {
    return this.buildTotalLearningTimePerStudentQuery(courseId, conditions);
  }

  async getTotalLearningTimePerStudentPaginated(
    courseId: UUIDType,
    conditions: SQL<unknown>[] = [],
    page: number = 1,
    perPage: number = DEFAULT_PAGE_SIZE,
    orderBy?: SQL<unknown>,
  ) {
    const query = this.buildTotalLearningTimePerStudentQuery(courseId, conditions);

    const orderedQuery = orderBy ? query.orderBy(orderBy) : query;

    return addPagination(orderedQuery.$dynamic(), page, perPage);
  }

  async getTotalLearningTimePerStudentCount(courseId: UUIDType, conditions: SQL<unknown>[] = []) {
    const [{ totalItems }] = await this.db
      .select({ totalItems: countDistinct(lessonLearningTime.userId) })
      .from(lessonLearningTime)
      .leftJoin(users, eq(users.id, lessonLearningTime.userId))
      .leftJoin(groupUsers, eq(groupUsers.userId, users.id))
      .leftJoin(groups, eq(groups.id, groupUsers.groupId))
      .where(and(eq(lessonLearningTime.courseId, courseId), ...conditions));

    return totalItems ?? 0;
  }

  async getCourseTotalLearningTime(courseId: UUIDType, conditions: SQL<unknown>[] = []) {
    const result = await this.db
      .select({
        averageSeconds: sql<number>`COALESCE(SUM(${lessonLearningTime.totalSeconds}), 0)::INTEGER / GREATEST(COUNT(DISTINCT ${lessonLearningTime.userId})::INTEGER, 1)`,
        uniqueUsers: sql<number>`COUNT(DISTINCT ${lessonLearningTime.userId})::INTEGER`,
      })
      .from(lessonLearningTime)
      .where(and(eq(lessonLearningTime.courseId, courseId), ...conditions));

    return result[0] ?? { totalSeconds: 0, uniqueUsers: 0 };
  }

  private buildTotalLearningTimePerStudentQuery(
    courseId: UUIDType,
    conditions: SQL<unknown>[] = [],
  ) {
    return this.db
      .select({
        id: lessonLearningTime.userId,
        name: sql<string>`${users.firstName} || ' ' || ${users.lastName}`,
        studentAvatarKey: users.avatarReference,
        totalSeconds: sql<number>`SUM(${lessonLearningTime.totalSeconds})::INTEGER`,
        groups: sql<Array<{ id: string; name: string }>>`(
          SELECT json_agg(json_build_object('id', g.id, 'name', g.name))
          FROM ${groups} g
          JOIN ${groupUsers} gu ON gu.group_id = g.id
          WHERE gu.user_id = ${users.id}
        )`,
      })
      .from(lessonLearningTime)
      .innerJoin(users, eq(lessonLearningTime.userId, users.id))
      .leftJoin(groupUsers, eq(groupUsers.userId, users.id))
      .leftJoin(groups, eq(groups.id, groupUsers.groupId))
      .where(and(eq(lessonLearningTime.courseId, courseId), ...conditions))
      .groupBy(
        lessonLearningTime.userId,
        users.firstName,
        users.lastName,
        users.email,
        users.avatarReference,
        users.id,
      );
  }

  async getStudentsByGroup(groupId: UUIDType) {
    return this.db
      .select({ id: groupUsers.userId })
      .from(groupUsers)
      .where(eq(groupUsers.groupId, groupId));
  }

  async getStudentsInCourse(courseId: UUIDType) {
    return this.db
      .select({
        id: users.id,
        name: sql<string>`${users.firstName} || ' ' || ${users.lastName}`,
      })
      .from(studentCourses)
      .innerJoin(users, eq(users.id, studentCourses.studentId))
      .where(
        and(
          eq(studentCourses.courseId, courseId),
          ne(studentCourses.status, COURSE_ENROLLMENT.NOT_ENROLLED),
        ),
      );
  }

  async getGroupsInCourse(courseId: UUIDType) {
    return this.db
      .select({
        id: groups.id,
        name: groups.name,
      })
      .from(studentCourses)
      .innerJoin(users, eq(studentCourses.studentId, users.id))
      .innerJoin(groupUsers, eq(users.id, groupUsers.userId))
      .innerJoin(groups, eq(groupUsers.groupId, groups.id))
      .where(
        and(
          eq(studentCourses.courseId, courseId),
          ne(studentCourses.status, COURSE_ENROLLMENT.NOT_ENROLLED),
        ),
      )
      .groupBy(groups.id);
  }
}
