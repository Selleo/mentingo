import { Inject, Injectable } from "@nestjs/common";
import { and, eq, ne, SQL, sql } from "drizzle-orm";

import { DatabasePg } from "src/common";
import {
  courses,
  groups,
  groupUsers,
  lessonLearningTime,
  lessons,
  studentCourses,
  users,
} from "src/storage/schema";

import type { UUIDType } from "src/common";
import { COURSE_ENROLLMENT } from "@repo/shared";

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
    return this.db
      .select({
        userId: lessonLearningTime.userId,
        userFirstName: users.firstName,
        userLastName: users.lastName,
        userEmail: users.email,
        totalSeconds: sql<number>`SUM(${lessonLearningTime.totalSeconds})::INTEGER`,
        lessonsWithTime: sql<number>`COUNT(DISTINCT ${lessonLearningTime.lessonId})::INTEGER`,
      })
      .from(lessonLearningTime)
      .innerJoin(users, eq(lessonLearningTime.userId, users.id))
      .where(and(eq(lessonLearningTime.courseId, courseId), ...conditions))
      .groupBy(lessonLearningTime.userId, users.firstName, users.lastName, users.email);
  }

  async getCourseTotalLearningTime(courseId: UUIDType, conditions: SQL<unknown>[] = []) {
    const result = await this.db
      .select({
        totalSeconds: sql<number>`COALESCE(SUM(${lessonLearningTime.totalSeconds}), 0)::INTEGER`,
        uniqueUsers: sql<number>`COUNT(DISTINCT ${lessonLearningTime.userId})::INTEGER`,
      })
      .from(lessonLearningTime)
      .where(and(eq(lessonLearningTime.courseId, courseId), ...conditions));

    return result[0] ?? { totalSeconds: 0, uniqueUsers: 0 };
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
