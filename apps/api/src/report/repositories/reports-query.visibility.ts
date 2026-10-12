import { SYSTEM_ROLE_SLUGS } from "@repo/shared";
import { and, eq, exists, inArray, or, sql } from "drizzle-orm";

import {
  courses,
  groupUsers,
  groups,
  learningPathCourses,
  learningPaths,
  permissionRoles,
  permissionUserRoles,
  studentCourses,
  studentLearningPaths,
  users,
} from "src/storage/schema";

import type { ReportQueryBuilder } from "./reports-query.types";
import type { ReportsAccessScope } from "../reports-access.types";
import type { SQL } from "drizzle-orm";

/**
 * The reporting visibility rules, defined once. A viewer sees a record when any of their
 * scopes allows it: the whole organisation, learners in groups they manage, or their own courses.
 */

export function groupIsVisible({ access, authorizedGroupIds }: ReportsAccessScope): SQL {
  return allOf(
    eq(groups.tenantId, access.tenantId),
    authorizedGroupIds.length ? inArray(groups.id, authorizedGroupIds) : sql`FALSE`,
  );
}

export function courseIsVisible(db: ReportQueryBuilder, scope: ReportsAccessScope): SQL {
  const { access } = scope;

  return allOf(
    eq(courses.tenantId, access.tenantId),
    eq(courses.isArchived, false),
    anyOf(
      allowedWhen(access.canReadOrganisation, () => sql`TRUE`),
      allowedWhen(access.ownedCoursesOnly, () => eq(courses.authorId, access.userId)),
      allowedWhen(access.canReadManagedGroups, () =>
        exists(managedLearnerEnrolledInCourse(db, scope)),
      ),
    ),
  );
}

export function pathIsVisible(db: ReportQueryBuilder, scope: ReportsAccessScope): SQL {
  const { access } = scope;

  return allOf(
    eq(learningPaths.tenantId, access.tenantId),
    anyOf(
      allowedWhen(access.canReadOrganisation, () => sql`TRUE`),
      allowedWhen(access.canReadManagedGroups, () =>
        exists(managedLearnerEnrolledInPath(db, scope)),
      ),
      allowedWhen(access.ownedCoursesOnly, () => exists(ownedCourseInPath(db, scope))),
    ),
  );
}

export function learnerIsVisible(db: ReportQueryBuilder, scope: ReportsAccessScope): SQL {
  const { access } = scope;

  return anyOf(
    allowedWhen(access.canReadOrganisation, () => sql`TRUE`),
    allowedWhen(access.canReadManagedGroups, () => exists(managedGroupMembership(db, scope))),
    allowedWhen(access.ownedCoursesOnly, () => exists(enrollmentInOwnedCourse(db, scope))),
  );
}

/** A reportable learner has the student role or an active enrollment the viewer can see. */
export function isReportableLearner(db: ReportQueryBuilder, scope: ReportsAccessScope): SQL {
  return anyOf(exists(studentRole(db)), exists(visibleActiveEnrollment(db, scope)));
}

/** Membership of the reported learner (`users.id`) in a group the viewer manages. */
function managedGroupMembership(
  db: ReportQueryBuilder,
  { access, managedGroupIds }: ReportsAccessScope,
) {
  return db
    .select({ userId: groupUsers.userId })
    .from(groupUsers)
    .where(
      and(
        eq(groupUsers.tenantId, access.tenantId),
        eq(groupUsers.userId, users.id),
        inManagedGroups(managedGroupIds),
      ),
    );
}

function managedLearnerEnrolledInCourse(
  db: ReportQueryBuilder,
  { managedGroupIds }: ReportsAccessScope,
) {
  return db
    .select({ courseId: studentCourses.courseId })
    .from(studentCourses)
    .innerJoin(
      groupUsers,
      and(
        eq(groupUsers.tenantId, studentCourses.tenantId),
        eq(groupUsers.userId, studentCourses.studentId),
      ),
    )
    .where(
      and(
        eq(studentCourses.tenantId, courses.tenantId),
        eq(studentCourses.courseId, courses.id),
        eq(studentCourses.status, "enrolled"),
        inManagedGroups(managedGroupIds),
      ),
    );
}

function managedLearnerEnrolledInPath(
  db: ReportQueryBuilder,
  { managedGroupIds }: ReportsAccessScope,
) {
  return db
    .select({ pathId: studentLearningPaths.learningPathId })
    .from(studentLearningPaths)
    .innerJoin(
      groupUsers,
      and(
        eq(groupUsers.tenantId, studentLearningPaths.tenantId),
        eq(groupUsers.userId, studentLearningPaths.studentId),
      ),
    )
    .where(
      and(
        eq(studentLearningPaths.tenantId, learningPaths.tenantId),
        eq(studentLearningPaths.learningPathId, learningPaths.id),
        inManagedGroups(managedGroupIds),
      ),
    );
}

function ownedCourseInPath(db: ReportQueryBuilder, { access }: ReportsAccessScope) {
  return db
    .select({ pathId: learningPathCourses.learningPathId })
    .from(learningPathCourses)
    .innerJoin(
      courses,
      and(
        eq(courses.tenantId, learningPathCourses.tenantId),
        eq(courses.id, learningPathCourses.courseId),
      ),
    )
    .where(
      and(
        eq(learningPathCourses.tenantId, learningPaths.tenantId),
        eq(learningPathCourses.learningPathId, learningPaths.id),
        eq(courses.authorId, access.userId),
        eq(courses.isArchived, false),
      ),
    );
}

function enrollmentInOwnedCourse(db: ReportQueryBuilder, { access }: ReportsAccessScope) {
  return db
    .select({ studentId: studentCourses.studentId })
    .from(studentCourses)
    .innerJoin(
      courses,
      and(eq(courses.tenantId, studentCourses.tenantId), eq(courses.id, studentCourses.courseId)),
    )
    .where(
      and(
        eq(studentCourses.tenantId, users.tenantId),
        eq(studentCourses.studentId, users.id),
        eq(studentCourses.status, "enrolled"),
        eq(courses.authorId, access.userId),
        eq(courses.isArchived, false),
      ),
    );
}

function visibleActiveEnrollment(db: ReportQueryBuilder, scope: ReportsAccessScope) {
  const { access } = scope;

  return db
    .select({ studentId: studentCourses.studentId })
    .from(studentCourses)
    .innerJoin(
      courses,
      and(eq(courses.tenantId, studentCourses.tenantId), eq(courses.id, studentCourses.courseId)),
    )
    .where(
      and(
        eq(studentCourses.tenantId, users.tenantId),
        eq(studentCourses.studentId, users.id),
        eq(studentCourses.status, "enrolled"),
        eq(courses.isArchived, false),
        anyOf(
          allowedWhen(access.canReadOrganisation, () => sql`TRUE`),
          allowedWhen(access.canReadManagedGroups, () => exists(managedGroupMembership(db, scope))),
          allowedWhen(access.ownedCoursesOnly, () => eq(courses.authorId, access.userId)),
        ),
      ),
    );
}

function studentRole(db: ReportQueryBuilder) {
  return db
    .select({ userId: permissionUserRoles.userId })
    .from(permissionUserRoles)
    .innerJoin(
      permissionRoles,
      and(
        eq(permissionRoles.tenantId, permissionUserRoles.tenantId),
        eq(permissionRoles.id, permissionUserRoles.roleId),
      ),
    )
    .where(
      and(
        eq(permissionUserRoles.tenantId, users.tenantId),
        eq(permissionUserRoles.userId, users.id),
        eq(permissionRoles.slug, SYSTEM_ROLE_SLUGS.STUDENT),
      ),
    );
}

function inManagedGroups(managedGroupIds: string[]): SQL {
  return managedGroupIds.length ? inArray(groupUsers.groupId, managedGroupIds) : sql`FALSE`;
}

function allowedWhen(isAllowed: boolean, predicate: () => SQL): SQL {
  return isAllowed ? predicate() : sql`FALSE`;
}

function allOf(...predicates: SQL[]): SQL {
  return and(...predicates) ?? sql`TRUE`;
}

function anyOf(...predicates: SQL[]): SQL {
  return or(...predicates) ?? sql`FALSE`;
}
