import { ForbiddenException } from "@nestjs/common";
import { PERMISSIONS } from "@repo/shared";
import { and, asc, eq, exists, inArray, or, sql } from "drizzle-orm";
import { match } from "ts-pattern";

import { DatabasePg } from "src/common";
import {
  courses,
  groupManagerGroups,
  groupUsers,
  groups,
  learningPaths,
  studentCourses,
  users,
} from "src/storage/schema";

import { REPORT_VIEWS } from "../constants/reports.constants";
import { REPORT_ERRORS } from "../constants/reports.errors";
import { getReferencedRecordIds } from "../utils/reports-filter.utils";

import { buildSavedQueryAvailability } from "./reports-query.availability";
import {
  courseIsVisible,
  groupIsVisible,
  isReportableLearner,
  learnerIsVisible,
  pathIsVisible,
} from "./reports-query.visibility";

import type { ReportVisibleRecord } from "./reports-query.types";
import type {
  ReportsAccess,
  ReportsAccessScope,
  ReportsScopeHashes,
} from "../reports-access.types";
import type { ReportDefinition } from "../schemas/reports.schema";
import type { SQL } from "drizzle-orm";
import type { CurrentUserType } from "src/common/types/current-user.type";

export class ReportsQueryScopeRepository {
  constructor(private readonly db: DatabasePg) {}

  buildSavedQueryAvailabilityPredicate(queryJson: SQL, access: ReportsAccess): SQL<boolean> {
    return buildSavedQueryAvailability(this.db, queryJson, access);
  }

  async findAccessScope(
    actor: CurrentUserType,
    access: ReportsAccess,
  ): Promise<ReportsAccessScope> {
    const managedGroupIds = await this.findManagedGroupIds(actor);
    const authorizedGroupIds = await this.findAuthorizedGroupIds(access, managedGroupIds);

    return {
      access,
      managedGroupIds: access.canReadManagedGroups ? managedGroupIds : [],
      authorizedGroupIds,
    };
  }

  /** Hashes of the live learner and course sets behind a scope, so exports notice when they change. */
  async findLiveScopeHashes(access: ReportsAccess): Promise<Required<ReportsScopeHashes>> {
    const [managedLearnersHash, ownedCoursesHash, ownedEnrollmentsHash] = await Promise.all([
      access.canReadManagedGroups ? this.hashManagedLearners(access) : "",
      access.ownedCoursesOnly ? this.hashOwnedCourses(access) : "",
      access.ownedCoursesOnly ? this.hashOwnedEnrollments(access) : "",
    ]);

    return { managedLearnersHash, ownedCoursesHash, ownedEnrollmentsHash };
  }

  async validateScopeReferences(query: ReportDefinition, scope: ReportsAccessScope): Promise<void> {
    const references = getReferencedRecordIds(query);

    await this.assertAllVisible(
      references.groupIds,
      (ids) => this.findVisibleGroups(ids, scope),
      REPORT_ERRORS.GROUP_OUTSIDE_SCOPE,
    );
    await this.assertAllVisible(
      references.courseIds,
      (ids) => this.findVisibleCourses(ids, scope),
      REPORT_ERRORS.COURSE_OUTSIDE_SCOPE,
    );
    await this.assertAllVisible(
      references.pathIds,
      (ids) => this.findVisiblePaths(ids, scope),
      REPORT_ERRORS.PATH_OUTSIDE_SCOPE,
    );
    await this.assertAllVisible(
      references.learnerIds,
      (ids) => this.findVisibleReportableLearners(ids, scope),
      REPORT_ERRORS.LEARNER_OUTSIDE_SCOPE,
    );
    await this.assertSubjectVisible(query, scope);
  }

  private async findManagedGroupIds(actor: CurrentUserType): Promise<string[]> {
    if (!actor.permissions.includes(PERMISSIONS.MANAGED_GROUP_RESULTS_READ)) return [];

    const managedGroups = await this.db
      .select({ id: groupManagerGroups.groupId })
      .from(groupManagerGroups)
      .where(
        and(
          eq(groupManagerGroups.tenantId, actor.tenantId),
          eq(groupManagerGroups.managerUserId, actor.userId),
        ),
      )
      .orderBy(asc(groupManagerGroups.groupId));

    return managedGroups.map(({ id }) => id);
  }

  /** Groups the viewer may select: all of them, the ones they manage, or ones with their learners. */
  private async findAuthorizedGroupIds(
    access: ReportsAccess,
    managedGroupIds: string[],
  ): Promise<string[]> {
    const groupWithOwnedCourseLearner = this.db
      .select({ groupId: groupUsers.groupId })
      .from(groupUsers)
      .innerJoin(
        studentCourses,
        and(
          eq(studentCourses.tenantId, groupUsers.tenantId),
          eq(studentCourses.studentId, groupUsers.userId),
        ),
      )
      .innerJoin(
        courses,
        and(eq(courses.tenantId, studentCourses.tenantId), eq(courses.id, studentCourses.courseId)),
      )
      .where(
        and(
          eq(groupUsers.tenantId, access.tenantId),
          eq(groupUsers.groupId, groups.id),
          eq(studentCourses.status, "enrolled"),
          eq(courses.authorId, access.userId),
          eq(courses.isArchived, false),
        ),
      );

    const visibleGroups = await this.db
      .selectDistinct({ id: groups.id })
      .from(groups)
      .where(
        and(
          eq(groups.tenantId, access.tenantId),
          or(
            access.canReadOrganisation ? sql`TRUE` : sql`FALSE`,
            managedGroupIds.length ? inArray(groups.id, managedGroupIds) : sql`FALSE`,
            access.ownedCoursesOnly ? exists(groupWithOwnedCourseLearner) : sql`FALSE`,
          ),
        ),
      )
      .orderBy(asc(groups.id));

    return visibleGroups.map(({ id }) => id);
  }

  private async hashManagedLearners(access: ReportsAccess): Promise<string> {
    const [row] = await this.db
      .select({
        hash: sql<string>`MD5(COALESCE(STRING_AGG(DISTINCT ${groupUsers.userId}::text, ',' ORDER BY ${groupUsers.userId}::text), ''))`,
      })
      .from(groupManagerGroups)
      .innerJoin(
        groupUsers,
        and(
          eq(groupUsers.tenantId, groupManagerGroups.tenantId),
          eq(groupUsers.groupId, groupManagerGroups.groupId),
        ),
      )
      .where(
        and(
          eq(groupManagerGroups.tenantId, access.tenantId),
          eq(groupManagerGroups.managerUserId, access.userId),
        ),
      );

    return row?.hash ?? "";
  }

  private async hashOwnedCourses(access: ReportsAccess): Promise<string> {
    const [row] = await this.db
      .select({
        hash: sql<string>`MD5(COALESCE(STRING_AGG(${courses.id}::text, ',' ORDER BY ${courses.id}::text), ''))`,
      })
      .from(courses)
      .where(and(eq(courses.tenantId, access.tenantId), eq(courses.authorId, access.userId)));

    return row?.hash ?? "";
  }

  private async hashOwnedEnrollments(access: ReportsAccess): Promise<string> {
    const [row] = await this.db
      .select({
        hash: sql<string>`MD5(COALESCE(STRING_AGG(
                DISTINCT (${studentCourses.studentId}::text || ':' || ${studentCourses.courseId}::text),
                ',' ORDER BY (${studentCourses.studentId}::text || ':' || ${studentCourses.courseId}::text)
              ), ''))`,
      })
      .from(studentCourses)
      .innerJoin(
        courses,
        and(eq(courses.tenantId, studentCourses.tenantId), eq(courses.id, studentCourses.courseId)),
      )
      .innerJoin(
        users,
        and(eq(users.tenantId, studentCourses.tenantId), eq(users.id, studentCourses.studentId)),
      )
      .where(
        and(
          eq(studentCourses.tenantId, access.tenantId),
          eq(studentCourses.status, "enrolled"),
          eq(courses.authorId, access.userId),
          eq(courses.isArchived, false),
          sql`${users.deletedAt} IS NULL`,
        ),
      );

    return row?.hash ?? "";
  }

  private async assertSubjectVisible(query: ReportDefinition, scope: ReportsAccessScope) {
    const { subjectId } = query;
    if (!subjectId || query.view === REPORT_VIEWS.ORGANISATION) return;

    const visibleSubjects = await match(query.view)
      .with(REPORT_VIEWS.COURSE, () => this.findVisibleCourses([subjectId], scope))
      .with(REPORT_VIEWS.DEVELOPMENT_PATHS, () => this.findVisiblePaths([subjectId], scope))
      .otherwise(() => this.findVisibleLearners([subjectId], scope));

    if (!visibleSubjects.length) throw new ForbiddenException(REPORT_ERRORS.SUBJECT_OUTSIDE_SCOPE);
  }

  private async assertAllVisible(
    ids: string[],
    findVisible: (ids: string[]) => Promise<ReportVisibleRecord[]>,
    error: string,
  ): Promise<void> {
    if (!ids.length) return;

    const visible = await findVisible(ids);
    if (visible.length !== ids.length) throw new ForbiddenException(error);
  }

  private findVisibleGroups(
    ids: string[],
    scope: ReportsAccessScope,
  ): Promise<ReportVisibleRecord[]> {
    return this.db
      .select({ id: groups.id })
      .from(groups)
      .where(and(inArray(groups.id, ids), groupIsVisible(scope)));
  }

  private findVisibleCourses(
    ids: string[],
    scope: ReportsAccessScope,
  ): Promise<ReportVisibleRecord[]> {
    return this.db
      .select({ id: courses.id })
      .from(courses)
      .where(and(inArray(courses.id, ids), courseIsVisible(this.db, scope)));
  }

  private findVisiblePaths(
    ids: string[],
    scope: ReportsAccessScope,
  ): Promise<ReportVisibleRecord[]> {
    return this.db
      .select({ id: learningPaths.id })
      .from(learningPaths)
      .where(and(inArray(learningPaths.id, ids), pathIsVisible(this.db, scope)));
  }

  private findVisibleLearners(
    ids: string[],
    scope: ReportsAccessScope,
  ): Promise<ReportVisibleRecord[]> {
    return this.db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          inArray(users.id, ids),
          eq(users.tenantId, scope.access.tenantId),
          sql`${users.deletedAt} IS NULL`,
          learnerIsVisible(this.db, scope),
        ),
      );
  }

  private findVisibleReportableLearners(
    ids: string[],
    scope: ReportsAccessScope,
  ): Promise<ReportVisibleRecord[]> {
    return this.db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          inArray(users.id, ids),
          eq(users.tenantId, scope.access.tenantId),
          sql`${users.deletedAt} IS NULL`,
          isReportableLearner(this.db, scope),
          learnerIsVisible(this.db, scope),
        ),
      );
  }
}
