import { and, asc, desc, eq, exists, inArray, or, sql } from "drizzle-orm";

import { currentLearningState } from "src/course-repetition/course-learning-state.sql";
import {
  chapters,
  certificates,
  courses,
  groupUsers,
  lessons,
  studentCourses,
  studentLessonProgress,
} from "src/storage/schema";

import { REPORT_VIEWS } from "../constants/reports.constants";

import type { ReportQueryContext } from "./reports-query.types";
import type { SQL } from "drizzle-orm";

function renderCte(name: string, query: { getSQL(): SQL }, materialized = false): SQL {
  const materialization = materialized ? sql`MATERIALIZED ` : sql``;
  return sql`${sql.identifier(name)} AS ${materialization}(${query.getSQL()})`;
}

export function buildFoundationalReportStages(context: ReportQueryContext): SQL[] {
  return [
    renderCte("scoped_enrollments", buildScopedEnrollments(context)),
    renderCte("course_lesson_counts", buildCourseLessonCounts(context), true),
    renderCte("learner_course_progress", buildLearnerCourseProgress(context), true),
    renderCte("learner_groups", buildLearnerGroups(context), true),
    renderCte("latest_course_certificates", buildLatestCourseCertificates(context), true),
  ];
}

function buildScopedEnrollments({ db, query, access, managedGroupIds }: ReportQueryContext) {
  const managerGroupMembership = db
    .select({ userId: groupUsers.userId })
    .from(groupUsers)
    .where(
      and(
        eq(groupUsers.tenantId, studentCourses.tenantId),
        eq(groupUsers.userId, studentCourses.studentId),
        managedGroupIds.length ? inArray(groupUsers.groupId, managedGroupIds) : sql`FALSE`,
      ),
    );
  const explicitGroupMembership = query.groupIds.length
    ? exists(
        db
          .select({ userId: groupUsers.userId })
          .from(groupUsers)
          .where(
            and(
              eq(groupUsers.tenantId, studentCourses.tenantId),
              eq(groupUsers.userId, studentCourses.studentId),
              inArray(groupUsers.groupId, query.groupIds),
            ),
          ),
      )
    : sql`TRUE`;
  const accessScope = or(
    access.canReadOrganisation ? sql`TRUE` : sql`FALSE`,
    access.ownedCoursesOnly ? eq(courses.authorId, access.userId) : sql`FALSE`,
    access.canReadManagedGroups ? exists(managerGroupMembership) : sql`FALSE`,
  );

  return db
    .select({
      tenant_id: studentCourses.tenantId,
      student_id: studentCourses.studentId,
      course_id: studentCourses.courseId,
      enrolled_at: studentCourses.enrolledAt,
      completed_at: studentCourses.completedAt,
      last_opened_at: studentCourses.lastOpenedAt,
      progress: studentCourses.progress,
    })
    .from(studentCourses)
    .innerJoin(
      courses,
      and(eq(courses.id, studentCourses.courseId), eq(courses.tenantId, studentCourses.tenantId)),
    )
    .where(
      and(
        eq(studentCourses.tenantId, access.tenantId),
        eq(studentCourses.status, "enrolled"),
        eq(courses.isArchived, false),
        accessScope,
        explicitGroupMembership,
        query.view === REPORT_VIEWS.COURSE
          ? eq(studentCourses.courseId, query.subjectId!)
          : undefined,
        query.view === REPORT_VIEWS.LEARNER
          ? eq(studentCourses.studentId, query.subjectId!)
          : undefined,
      ),
    );
}

function buildCourseLessonCounts({ db, access }: ReportQueryContext) {
  return db
    .select({
      tenant_id: chapters.tenantId,
      course_id: chapters.courseId,
      total_lessons: sql<number>`COUNT(${lessons.id})::int`.as("total_lessons"),
    })
    .from(chapters)
    .innerJoin(
      lessons,
      and(eq(lessons.chapterId, chapters.id), eq(lessons.tenantId, chapters.tenantId)),
    )
    .where(eq(chapters.tenantId, access.tenantId))
    .groupBy(chapters.tenantId, chapters.courseId);
}

function buildLearnerCourseProgress({ db, access }: ReportQueryContext) {
  return db
    .select({
      tenant_id: studentLessonProgress.tenantId,
      learner_id: sql`${studentLessonProgress.studentId}`.as("learner_id"),
      course_id: chapters.courseId,
      completed_lessons: sql<number>`
        COUNT(*) FILTER (WHERE ${studentLessonProgress.completedAt} IS NOT NULL)::int
      `.as("completed_lessons"),
      started: sql<boolean>`
        BOOL_OR(COALESCE(${studentLessonProgress.isStarted}, FALSE) OR ${studentLessonProgress.completedAt} IS NOT NULL)
      `.as("started"),
      last_completed_at: sql<Date | null>`MAX(${studentLessonProgress.completedAt})`.as(
        "last_completed_at",
      ),
    })
    .from(studentLessonProgress)
    .innerJoin(
      lessons,
      and(
        eq(lessons.id, studentLessonProgress.lessonId),
        eq(lessons.tenantId, studentLessonProgress.tenantId),
      ),
    )
    .innerJoin(
      chapters,
      and(
        eq(chapters.id, studentLessonProgress.chapterId),
        eq(chapters.tenantId, studentLessonProgress.tenantId),
        eq(chapters.id, lessons.chapterId),
      ),
    )
    .where(
      and(
        eq(studentLessonProgress.tenantId, access.tenantId),
        currentLearningState(studentLessonProgress.learningStateId),
      ),
    )
    .groupBy(studentLessonProgress.tenantId, studentLessonProgress.studentId, chapters.courseId);
}

function buildLearnerGroups({ db, access, authorizedGroupIds }: ReportQueryContext) {
  return db
    .select({
      tenant_id: groupUsers.tenantId,
      user_id: groupUsers.userId,
      group_ids: sql<string[]>`ARRAY_AGG(DISTINCT ${groupUsers.groupId})`.as("group_ids"),
    })
    .from(groupUsers)
    .where(
      and(
        eq(groupUsers.tenantId, access.tenantId),
        authorizedGroupIds.length ? inArray(groupUsers.groupId, authorizedGroupIds) : sql`FALSE`,
      ),
    )
    .groupBy(groupUsers.tenantId, groupUsers.userId);
}

function buildLatestCourseCertificates({ db, access }: ReportQueryContext) {
  return db
    .selectDistinctOn([certificates.tenantId, certificates.userId, certificates.courseId], {
      tenant_id: certificates.tenantId,
      user_id: certificates.userId,
      course_id: certificates.courseId,
      id: certificates.id,
      status: certificates.status,
      issued_at: certificates.issuedAt,
      expires_at: certificates.expiresAt,
      archive_reason: certificates.archiveReason,
    })
    .from(certificates)
    .where(eq(certificates.tenantId, access.tenantId))
    .orderBy(
      asc(certificates.tenantId),
      asc(certificates.userId),
      asc(certificates.courseId),
      desc(certificates.issuedAt),
    );
}
