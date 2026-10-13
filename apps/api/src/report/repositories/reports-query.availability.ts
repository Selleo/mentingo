import { SYSTEM_ROLE_SLUGS } from "@repo/shared";
import { and, eq, exists, inArray, isNull, or, sql } from "drizzle-orm";

import {
  courses,
  groupManagerGroups,
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

import { REPORT_UUID_SQL_PATTERN } from "../constants/reports-filter.constants";
import { REPORT_FILTER_FIELDS, REPORT_VIEWS } from "../constants/reports.constants";

import type { ReportReferenceQuery } from "./reports-query.types";
import type { ReportsAccess } from "../reports-access.types";
import type { SQL } from "drizzle-orm";
import type { DatabasePg } from "src/common";

/** One statement checks every saved configuration against the actor's current scope. */
export function buildSavedQueryAvailability(
  db: DatabasePg,
  query: SQL,
  access: ReportsAccess,
): SQL<boolean> {
  const scope = buildAccessibleReferences(db, access);
  const conditions = readFilterConditions(query);
  const groupReferences = sql`(
    SELECT value AS id FROM jsonb_array_elements_text(${query} -> 'groupIds')
    UNION ALL SELECT id FROM ${readFilterReferences(
      conditions,
      REPORT_FILTER_FIELDS.GROUP_ID,
    )} AS filter_groups
  )`;
  const allReferencesAllowed = and(
    referencesAllowed(db, groupReferences, scope.groups),
    referencesAllowed(
      db,
      readFilterReferences(conditions, REPORT_FILTER_FIELDS.COURSE_ID),
      scope.courses,
    ),
    referencesAllowed(
      db,
      readFilterReferences(conditions, REPORT_FILTER_FIELDS.PATH_ID),
      scope.paths,
    ),
    referencesAllowed(
      db,
      readFilterReferences(conditions, REPORT_FILTER_FIELDS.LEARNER, true),
      scope.learners,
    ),
  );
  const subjectId = sql`(${query} ->> 'subjectId')::uuid`;
  const subjectAllowed = sql`CASE ${query} ->> 'view'
    WHEN ${REPORT_VIEWS.ORGANISATION} THEN ${query} ->> 'subjectId' IS NULL
    WHEN ${REPORT_VIEWS.COURSE} THEN ${containsReference(db, scope.courses, subjectId)}
    WHEN ${REPORT_VIEWS.DEVELOPMENT_PATHS} THEN ${containsReference(db, scope.paths, subjectId)}
    WHEN ${REPORT_VIEWS.LEARNER} THEN ${containsReference(db, scope.learnerSubjects, subjectId)}
    ELSE FALSE END`;
  return sql<boolean>`${allReferencesAllowed} AND ${subjectAllowed}`;
}

export function buildAccessibleReferences(db: DatabasePg, access: ReportsAccess) {
  const managedGroups = db
    .select({ id: groupManagerGroups.groupId })
    .from(groupManagerGroups)
    .where(
      and(
        eq(groupManagerGroups.tenantId, access.tenantId),
        eq(groupManagerGroups.managerUserId, access.userId),
      ),
    );
  const managedLearners = db
    .select({ id: groupUsers.userId })
    .from(groupUsers)
    .where(
      and(eq(groupUsers.tenantId, access.tenantId), inArray(groupUsers.groupId, managedGroups)),
    );
  const ownedLearners = db
    .select({ id: studentCourses.studentId })
    .from(studentCourses)
    .innerJoin(
      courses,
      and(eq(courses.id, studentCourses.courseId), eq(courses.tenantId, studentCourses.tenantId)),
    )
    .where(
      and(
        eq(studentCourses.tenantId, access.tenantId),
        eq(studentCourses.status, "enrolled"),
        eq(courses.authorId, access.userId),
        eq(courses.isArchived, false),
      ),
    );
  const learnerScope = or(
    allowed(access.canReadOrganisation),
    access.canReadManagedGroups ? inArray(users.id, managedLearners) : sql`FALSE`,
    access.ownedCoursesOnly ? inArray(users.id, ownedLearners) : sql`FALSE`,
  );
  const managerCourseEnrollment = db
    .select({ id: studentCourses.courseId })
    .from(studentCourses)
    .where(
      and(
        eq(studentCourses.tenantId, access.tenantId),
        eq(studentCourses.status, "enrolled"),
        inArray(studentCourses.studentId, managedLearners),
      ),
    );
  const visibleCourses = db
    .select({ id: courses.id })
    .from(courses)
    .where(
      and(
        eq(courses.tenantId, access.tenantId),
        eq(courses.isArchived, false),
        or(
          allowed(access.canReadOrganisation),
          access.ownedCoursesOnly ? eq(courses.authorId, access.userId) : sql`FALSE`,
          access.canReadManagedGroups ? inArray(courses.id, managerCourseEnrollment) : sql`FALSE`,
        ),
      ),
    );
  const managerPaths = db
    .select({ id: studentLearningPaths.learningPathId })
    .from(studentLearningPaths)
    .where(
      and(
        eq(studentLearningPaths.tenantId, access.tenantId),
        inArray(studentLearningPaths.studentId, managedLearners),
      ),
    );
  const ownedPaths = db
    .select({ id: learningPathCourses.learningPathId })
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
        eq(learningPathCourses.tenantId, access.tenantId),
        eq(courses.authorId, access.userId),
        eq(courses.isArchived, false),
      ),
    );
  const visiblePaths = db
    .select({ id: learningPaths.id })
    .from(learningPaths)
    .where(
      and(
        eq(learningPaths.tenantId, access.tenantId),
        or(
          allowed(access.canReadOrganisation),
          access.canReadManagedGroups ? inArray(learningPaths.id, managerPaths) : sql`FALSE`,
          access.ownedCoursesOnly ? inArray(learningPaths.id, ownedPaths) : sql`FALSE`,
        ),
      ),
    );
  const ownedGroups = db
    .select({ id: groupUsers.groupId })
    .from(groupUsers)
    .where(
      and(eq(groupUsers.tenantId, access.tenantId), inArray(groupUsers.userId, ownedLearners)),
    );
  const visibleGroups = db
    .select({ id: groups.id })
    .from(groups)
    .where(
      and(
        eq(groups.tenantId, access.tenantId),
        or(
          allowed(access.canReadOrganisation),
          access.canReadManagedGroups ? inArray(groups.id, managedGroups) : sql`FALSE`,
          access.ownedCoursesOnly ? inArray(groups.id, ownedGroups) : sql`FALSE`,
        ),
      ),
    );
  const studentRole = db
    .select({ id: permissionUserRoles.userId })
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
        eq(permissionUserRoles.tenantId, access.tenantId),
        eq(permissionRoles.slug, SYSTEM_ROLE_SLUGS.STUDENT),
      ),
    );
  const enrolledLearners = db
    .select({ id: studentCourses.studentId })
    .from(studentCourses)
    .innerJoin(
      courses,
      and(eq(courses.tenantId, studentCourses.tenantId), eq(courses.id, studentCourses.courseId)),
    )
    .where(
      and(
        eq(studentCourses.tenantId, access.tenantId),
        eq(studentCourses.status, "enrolled"),
        eq(courses.isArchived, false),
        or(
          allowed(access.canReadOrganisation),
          access.canReadManagedGroups
            ? inArray(studentCourses.studentId, managedLearners)
            : sql`FALSE`,
          access.ownedCoursesOnly ? eq(courses.authorId, access.userId) : sql`FALSE`,
        ),
      ),
    );
  const visibleLearner = and(
    eq(users.tenantId, access.tenantId),
    isNull(users.deletedAt),
    learnerScope,
  );
  return {
    groups: visibleGroups,
    courses: visibleCourses,
    paths: visiblePaths,
    learners: db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          visibleLearner,
          or(inArray(users.id, studentRole), inArray(users.id, enrolledLearners)),
        ),
      ),
    learnerSubjects: db.select({ id: users.id }).from(users).where(visibleLearner),
  };
}

function referencesAllowed(db: DatabasePg, references: SQL, accessible: ReportReferenceQuery): SQL {
  return sql`NOT EXISTS (SELECT 1 FROM ${references} AS requested_reference
    WHERE NOT ${containsReference(db, accessible, sql`requested_reference.id::uuid`)})`;
}

function containsReference(db: DatabasePg, accessible: ReportReferenceQuery, id: SQL): SQL {
  const visible = accessible.as("visible_reference");
  return exists(db.select({ id: visible.id }).from(visible).where(eq(visible.id, id)));
}

function readFilterConditions(query: SQL): SQL {
  return sql`(
    SELECT rule AS condition FROM jsonb_array_elements(COALESCE(${query} -> 'filter' -> 'rules', '[]'::jsonb)) AS top_rule(rule)
      WHERE rule ? 'field'
    UNION ALL
    SELECT nested_rule.rule AS condition
      FROM jsonb_array_elements(COALESCE(${query} -> 'filter' -> 'rules', '[]'::jsonb)) AS top_rule(rule)
      CROSS JOIN LATERAL jsonb_array_elements(COALESCE(top_rule.rule -> 'rules', '[]'::jsonb)) AS nested_rule(rule)
      WHERE top_rule.rule ? 'rules'
  )`;
}

function readFilterReferences(conditions: SQL, field: string, uuidOnly = false): SQL {
  return sql`(
    SELECT value #>> '{}' AS id FROM ${conditions} AS filter_condition
    CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(condition -> 'value') = 'array'
      THEN condition -> 'value' ELSE jsonb_build_array(condition -> 'value') END) AS filter_value(value)
    WHERE condition ->> 'field' = ${field} AND condition ->> 'operator' IN ('eq', 'neq', 'in')
      ${uuidOnly ? sql`AND (value #>> '{}') ~* ${REPORT_UUID_SQL_PATTERN}` : sql``}
  )`;
}

function allowed(value: boolean): SQL {
  return value ? sql`TRUE` : sql`FALSE`;
}
