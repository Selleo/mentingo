import { Inject, Injectable } from "@nestjs/common";
import { and, eq, sql } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { courses, lessonLearningTime, lessons, users } from "src/storage/schema";

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

  async getAverageLearningTimePerLesson(courseId: UUIDType) {
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
      .where(eq(lessonLearningTime.courseId, courseId))
      .groupBy(
        lessonLearningTime.lessonId,
        lessons.title,
        lessons.displayOrder,
        courses.baseLanguage,
      )
      .orderBy(lessons.displayOrder);
  }

  async getTotalLearningTimePerStudent(courseId: UUIDType) {
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
      .where(eq(lessonLearningTime.courseId, courseId))
      .groupBy(lessonLearningTime.userId, users.firstName, users.lastName, users.email);
  }

  async getCourseTotalLearningTime(courseId: UUIDType) {
    const result = await this.db
      .select({
        totalSeconds: sql<number>`COALESCE(SUM(${lessonLearningTime.totalSeconds}), 0)::INTEGER`,
        uniqueUsers: sql<number>`COUNT(DISTINCT ${lessonLearningTime.userId})::INTEGER`,
      })
      .from(lessonLearningTime)
      .where(eq(lessonLearningTime.courseId, courseId));

    return result[0] ?? { totalSeconds: 0, uniqueUsers: 0 };
  }
}
