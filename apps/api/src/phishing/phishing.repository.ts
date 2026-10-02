import { Inject, Injectable } from "@nestjs/common";
import { PERMISSIONS, type SupportedLanguages } from "@repo/shared";
import { and, eq, inArray, isNull, ne, sql } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { getGroupManagerGroupScopeCondition } from "src/common/permissions/group-manager-scope.utils";
import { LocalizationService } from "src/localization/localization.service";
import { DB } from "src/storage/db/db.providers";
import { courses, groups, groupUsers, users, studentCourses } from "src/storage/schema";

import type { CurrentUserType } from "src/common/types/current-user.type";
@Injectable()
export class PhishingRepository {
  constructor(
    @Inject(DB) private readonly db: DatabasePg,
    private readonly localization: LocalizationService,
  ) {}
  async options(language: SupportedLanguages) {
    const [people, departments, training] = await Promise.all([
      this.db
        .select({
          id: users.id,
          label: sql<string>`${users.firstName} || ' ' || ${users.lastName} || ' (' || ${users.email} || ')'`,
        })
        .from(users)
        .where(and(isNull(users.deletedAt), eq(users.archived, false)))
        .orderBy(users.lastName),
      this.db
        .select({
          id: groups.id,
          label: this.localization.getLocalizedSqlField(groups.name, language, groups),
        })
        .from(groups),
      this.db
        .select({
          id: courses.id,
          label: this.localization.getLocalizedSqlField(courses.title, language),
        })
        .from(courses)
        .where(and(ne(courses.status, "draft"), eq(courses.priceInCents, 0))),
    ]);
    const memberships = await this.db
      .select({ groupId: groupUsers.groupId, userId: groupUsers.userId })
      .from(groupUsers);
    const eligible = new Set(people.map((user) => user.id));
    return {
      users: people,
      groups: departments.map((group) => ({
        ...group,
        userIds: memberships
          .filter((member) => member.groupId === group.id && eligible.has(member.userId))
          .map((member) => member.userId),
      })),
      courses: training,
    };
  }
  async course(id: string) {
    const [course] = await this.db
      .select({ id: courses.id })
      .from(courses)
      .where(and(eq(courses.id, id), ne(courses.status, "draft"), eq(courses.priceInCents, 0)));
    return course;
  }
  async user(id: string) {
    const [user] = await this.db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(and(eq(users.id, id), isNull(users.deletedAt), eq(users.archived, false)));
    return user;
  }
  async recipients(userIds: string[], groupIds: string[]) {
    const members = groupIds.length
      ? await this.db
          .select({ userId: groupUsers.userId })
          .from(groupUsers)
          .where(inArray(groupUsers.groupId, groupIds))
      : [];
    const ids = [...new Set([...userIds, ...members.map((m) => m.userId)])];
    if (!ids.length) return [];
    const people = await this.db
      .select({
        userId: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(users)
      .where(and(inArray(users.id, ids), isNull(users.deletedAt), eq(users.archived, false)));
    const memberships = await this.db
      .select({ userId: groupUsers.userId, groupId: groupUsers.groupId })
      .from(groupUsers)
      .where(inArray(groupUsers.userId, ids));
    return people.map((user) => ({
      ...user,
      groupIds: memberships.filter((m) => m.userId === user.userId).map((m) => m.groupId),
    }));
  }
  async groups(actor: CurrentUserType, language: SupportedLanguages) {
    return this.db
      .select({
        id: groups.id,
        name: this.localization.getLocalizedSqlField(groups.name, language, groups),
      })
      .from(groups)
      .where(getGroupManagerGroupScopeCondition(actor, groups.id, [PERMISSIONS.PHISHING_MANAGE]));
  }
  async enrollment(courseId: string, userIds: string[]) {
    if (!userIds.length) return [];
    return this.db
      .select({
        userId: studentCourses.studentId,
        status: studentCourses.status,
        progress: studentCourses.progress,
      })
      .from(studentCourses)
      .where(
        and(eq(studentCourses.courseId, courseId), inArray(studentCourses.studentId, userIds)),
      );
  }
  async lockEnrollment(tenantId: string, courseId: string, userId: string) {
    await this.db.execute(
      sql`SELECT pg_advisory_xact_lock(hashtextextended(${`${tenantId}:${courseId}:${userId}`},0))`,
    );
  }
}
