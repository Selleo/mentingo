import { Inject, Injectable } from "@nestjs/common";
import { PERMISSIONS, COURSE_STATUSES, type SupportedLanguages } from "@repo/shared";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";

import { DatabasePg } from "src/common";
import {
  getGroupManagerLearnerScopeCondition,
  getGroupManagerCourseScopeCondition,
} from "src/common/permissions/group-manager-scope.utils";
import { LocalizationService } from "src/localization/localization.service";
import { DB } from "src/storage/db/db.providers";
import { courses, users, permissionRoles, permissionUserRoles } from "src/storage/schema";

import type { CurrentUserType } from "src/common/types/current-user.type";

@Injectable()
export class CompetenciesContextRepository {
  constructor(
    @Inject(DB) private readonly db: DatabasePg,
    private readonly localizationService: LocalizationService,
  ) {}
  async findManagedSubjects(actor: CurrentUserType) {
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
  async findPeople(ids?: string[]) {
    if (ids && !ids.length) return [];
    return this.db
      .select({
        id: users.id,
        name: sql<string>`${users.firstName} || ' ' || ${users.lastName}`,
        archived: users.archived,
        avatarReference: users.avatarReference,
      })
      .from(users)
      .where(and(isNull(users.deletedAt), ids ? inArray(users.id, ids) : undefined))
      .orderBy(users.lastName, users.firstName);
  }
  async findAvailableCourses(actor: CurrentUserType, language: SupportedLanguages) {
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
  async courseExists(id: string) {
    const [course] = await this.db
      .select({ id: courses.id })
      .from(courses)
      .where(eq(courses.id, id));

    return Boolean(course);
  }
  /** Users with a revision that changes whenever their name or status changes; everyone unless listed. */
  async findPeopleSnapshots(ids?: string[]) {
    return this.db
      .select({
        id: users.id,
        name: sql<string>`${users.firstName} || ' ' || ${users.lastName}`,
        active: sql<boolean>`${users.deletedAt} IS NULL AND NOT ${users.archived}`,
        revision:
          sql<number>`floor(extract(epoch FROM GREATEST(${users.updatedAt}, ${users.deletedAt})) * 1000)::bigint`.mapWith(
            Number,
          ),
      })
      .from(users)
      .where(ids ? inArray(users.id, ids) : undefined);
  }
  async findActorIdentity(userId: string) {
    const [identity] = await this.db
      .select({
        userId: users.id,
        email: users.email,
        tenantId: users.tenantId,
        roleSlugs: sql<
          string[]
        >`coalesce(array_agg(${permissionRoles.slug}) filter (where ${permissionRoles.slug} is not null), '{}')`,
      })
      .from(users)
      .leftJoin(permissionUserRoles, eq(permissionUserRoles.userId, users.id))
      .leftJoin(permissionRoles, eq(permissionRoles.id, permissionUserRoles.roleId))
      .where(and(eq(users.id, userId), eq(users.archived, false), isNull(users.deletedAt)))
      .groupBy(users.id, users.email, users.tenantId);

    return identity ?? null;
  }
}
