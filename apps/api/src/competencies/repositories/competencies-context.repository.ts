import { Inject, Injectable } from "@nestjs/common";
import {
  PERMISSIONS,
  LESSON_TYPES,
  COURSE_STATUSES,
  COURSE_ENROLLMENT,
  type SupportedLanguages,
} from "@repo/shared";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";

import { DatabasePg } from "src/common";
import {
  getGroupManagerLearnerScopeCondition,
  getGroupManagerCourseScopeCondition,
} from "src/common/permissions/group-manager-scope.utils";
import { hasPermission } from "src/common/permissions/permission.utils";
import { LocalizationService } from "src/localization/localization.service";
import { DB } from "src/storage/db/db.providers";
import {
  courses,
  users,
  lessons,
  chapters,
  permissionRoles,
  permissionUserRoles,
  studentCourses,
} from "src/storage/schema";

import type { CurrentUserType } from "src/common/types/current-user.type";

@Injectable()
export class CompetenciesContextRepository {
  constructor(
    @Inject(DB) private readonly db: DatabasePg,
    private readonly localizationService: LocalizationService,
  ) {}
  async managedSubjects(actor: CurrentUserType) {
    if (
      !hasPermission(actor.permissions, PERMISSIONS.COMPETENCIES_MANAGE) &&
      !hasPermission(actor.permissions, PERMISSIONS.MANAGED_GROUP_RESULTS_READ)
    )
      return [];
    return this.db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          isNull(users.deletedAt),
          eq(users.archived, false),
          getGroupManagerLearnerScopeCondition(actor, users.id, [PERMISSIONS.COMPETENCIES_MANAGE]),
        ),
      );
  }
  async people(ids?: string[]) {
    if (ids && !ids.length) return [];
    return this.db
      .select({
        id: users.id,
        name: sql<string>`${users.firstName} || ' ' || ${users.lastName}`,
        archived: users.archived,
      })
      .from(users)
      .where(and(isNull(users.deletedAt), ids ? inArray(users.id, ids) : undefined))
      .orderBy(users.lastName, users.firstName);
  }
  async availableCourses(actor: CurrentUserType, language: SupportedLanguages) {
    return this.db
      .select({
        id: courses.id,
        name: this.localizationService.getLocalizedSqlField(courses.title, language),
      })
      .from(courses)
      .where(
        and(
          inArray(courses.status, [COURSE_STATUSES.PUBLISHED, COURSE_STATUSES.PRIVATE]),
          eq(courses.isArchived, false),
          getGroupManagerCourseScopeCondition(actor, courses.id, [
            PERMISSIONS.COURSE_READ_MANAGEABLE,
          ]),
        ),
      );
  }
  async learningResources(actor: CurrentUserType, language: SupportedLanguages) {
    const available = await this.availableCourses(actor, language);
    if (!available.length) return [];
    const rows = await this.db
      .select({
        id: lessons.id,
        name: this.localizationService.getLocalizedSqlField(lessons.title, language),
        kind: lessons.type,
        courseId: chapters.courseId,
      })
      .from(lessons)
      .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
      .innerJoin(courses, eq(courses.id, chapters.courseId))
      .where(
        and(
          inArray(
            chapters.courseId,
            available.map((course) => course.id),
          ),
          inArray(lessons.type, [LESSON_TYPES.QUIZ, LESSON_TYPES.AI_MENTOR]),
        ),
      );
    return rows.map((row) => ({
      ...row,
      kind: row.kind === LESSON_TYPES.AI_MENTOR ? "ai-mentor" : "quiz",
    }));
  }
  async learningResourceExists(kind: string, id: string) {
    if (kind === "course")
      return (
        (await this.db.select({ id: courses.id }).from(courses).where(eq(courses.id, id))).length >
        0
      );
    if (kind === "quiz" || kind === "ai-mentor")
      return (
        (
          await this.db
            .select({ id: lessons.id })
            .from(lessons)
            .where(
              and(
                eq(lessons.id, id),
                eq(lessons.type, kind === "ai-mentor" ? LESSON_TYPES.AI_MENTOR : LESSON_TYPES.QUIZ),
              ),
            )
        ).length > 0
      );
    return true;
  }
  async actorIdentity(userId: string) {
    const [user] = await this.db
      .select({ userId: users.id, email: users.email, tenantId: users.tenantId })
      .from(users)
      .where(and(eq(users.id, userId), eq(users.archived, false), isNull(users.deletedAt)));
    if (!user) return null;
    const roles = await this.db
      .select({ slug: permissionRoles.slug })
      .from(permissionUserRoles)
      .innerJoin(permissionRoles, eq(permissionRoles.id, permissionUserRoles.roleId))
      .where(eq(permissionUserRoles.userId, userId));
    return { ...user, roleSlugs: roles.map((role) => role.slug) };
  }
  async enrolled(courseId: string, subjectId: string) {
    return (
      (
        await this.db
          .select({ id: studentCourses.id })
          .from(studentCourses)
          .where(
            and(
              eq(studentCourses.courseId, courseId),
              eq(studentCourses.studentId, subjectId),
              eq(studentCourses.status, COURSE_ENROLLMENT.ENROLLED),
            ),
          )
      ).length > 0
    );
  }
  async lockAssignment(courseId: string, subjectId: string) {
    await this.db.execute(
      sql`SELECT pg_advisory_xact_lock(hashtextextended(${`competencies:${courseId}:${subjectId}`},0))`,
    );
  }
}
