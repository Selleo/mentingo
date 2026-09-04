import { Inject, Injectable } from "@nestjs/common";
import { COURSE_ENROLLMENT, type SupportedLanguages } from "@repo/shared";
import { and, countDistinct, eq, isNull, ne, sql } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { addPagination, DEFAULT_PAGE_SIZE } from "src/common/pagination";
import { getRestrictedIdsCondition } from "src/common/utils/restrictedIds";
import { LocalizationService } from "src/localization/localization.service";
import {
  chapters,
  courses,
  groups,
  groupManagerGroups,
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
  constructor(
    @Inject("DB") private readonly db: DatabasePg,
    private readonly localizationService: LocalizationService,
  ) {}

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
      .where(and(eq(lessonLearningTime.courseId, courseId), isNull(users.deletedAt)));
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
      .innerJoin(users, eq(lessonLearningTime.userId, users.id))
      .innerJoin(lessons, eq(lessonLearningTime.lessonId, lessons.id))
      .innerJoin(courses, eq(lessonLearningTime.courseId, courses.id))
      .where(and(eq(lessonLearningTime.courseId, courseId), isNull(users.deletedAt), ...conditions))
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
      .where(
        and(eq(lessonLearningTime.courseId, courseId), isNull(users.deletedAt), ...conditions),
      );

    return totalItems ?? 0;
  }

  async getCourseTotalLearningTime(courseId: UUIDType, learnerIds?: UUIDType[]) {
    const learnerScopeCondition = getRestrictedIdsCondition(
      learnerIds !== undefined,
      learnerIds ?? [],
      studentCourses.studentId,
    );

    const result = await this.db
      .select({
        averageSeconds: sql<number>`COALESCE(SUM(${lessonLearningTime.totalSeconds}), 0)::INTEGER / GREATEST(COUNT(DISTINCT ${studentCourses.studentId})::INTEGER, 1)`,
        uniqueUsers: sql<number>`COUNT(DISTINCT ${studentCourses.studentId})::INTEGER`,
      })
      .from(studentCourses)
      .innerJoin(users, eq(studentCourses.studentId, users.id))
      .leftJoin(
        lessonLearningTime,
        and(
          eq(lessonLearningTime.userId, studentCourses.studentId),
          eq(lessonLearningTime.courseId, studentCourses.courseId),
        ),
      )
      .where(
        and(
          eq(studentCourses.courseId, courseId),
          eq(studentCourses.status, COURSE_ENROLLMENT.ENROLLED),
          isNull(users.deletedAt),
          learnerScopeCondition,
        ),
      );

    return result[0] ?? { averageSeconds: 0, uniqueUsers: 0 };
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
          SELECT json_agg(
            json_build_object(
              'id', ${groups.id},
              'name', ${this.localizationService.getLocalizedSqlField(
                groups.name,
                undefined,
                groups,
              )}
            )
          )
          FROM ${groups}
          JOIN ${groupUsers} ON ${groupUsers.groupId} = ${groups.id}
          WHERE ${groupUsers.userId} = ${users.id}
        )`,
      })
      .from(lessonLearningTime)
      .innerJoin(users, eq(lessonLearningTime.userId, users.id))
      .where(and(eq(lessonLearningTime.courseId, courseId), isNull(users.deletedAt), ...conditions))
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
      .innerJoin(users, eq(users.id, groupUsers.userId))
      .where(and(eq(groupUsers.groupId, groupId), isNull(users.deletedAt)));
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
          isNull(users.deletedAt),
        ),
      );
  }

  async getGroupsInCourse(
    courseId: UUIDType,
    language?: SupportedLanguages,
    conditions: SQL[] = [],
  ) {
    return this.db
      .select({
        id: groups.id,
        name: this.localizationService.getLocalizedSqlField(groups.name, language, groups),
      })
      .from(studentCourses)
      .innerJoin(users, eq(studentCourses.studentId, users.id))
      .innerJoin(groupUsers, eq(users.id, groupUsers.userId))
      .innerJoin(groups, eq(groupUsers.groupId, groups.id))
      .where(
        and(
          eq(studentCourses.courseId, courseId),
          ne(studentCourses.status, COURSE_ENROLLMENT.NOT_ENROLLED),
          isNull(users.deletedAt),
          ...conditions,
        ),
      )
      .groupBy(groups.id);
  }

  async isGroupManagedByUser(groupId: UUIDType, managerUserId: UUIDType) {
    const [managedGroup] = await this.db
      .select({ id: groupManagerGroups.id })
      .from(groupManagerGroups)
      .where(
        and(
          eq(groupManagerGroups.managerUserId, managerUserId),
          eq(groupManagerGroups.groupId, groupId),
        ),
      )
      .limit(1);

    return Boolean(managedGroup);
  }

  async isLearnerManagedByUser(learnerId: UUIDType, managerUserId: UUIDType) {
    const [managedLearner] = await this.db
      .select({ id: groupUsers.id })
      .from(groupManagerGroups)
      .innerJoin(groupUsers, eq(groupUsers.groupId, groupManagerGroups.groupId))
      .where(
        and(eq(groupManagerGroups.managerUserId, managerUserId), eq(groupUsers.userId, learnerId)),
      )
      .limit(1);

    return Boolean(managedLearner);
  }
}
