import { Inject, Injectable } from "@nestjs/common";
import { COURSE_ENROLLMENT, PERMISSIONS, type SupportedLanguages } from "@repo/shared";
import { and, eq, inArray, isNotNull, isNull, not, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { DatabasePg, type UUIDType } from "src/common";
import { EmailService } from "src/common/emails/emails.service";
import { userHasAnyPermissionsCondition } from "src/common/permissions/permission-sql.utils";
import { LocalizationService } from "src/localization/localization.service";
import { DB } from "src/storage/db/db.providers";
import {
  courses,
  groupCourses,
  groups,
  groupUsers,
  settings,
  studentCourses,
  tenants,
  users,
} from "src/storage/schema";

import type {
  CourseDueDateReminderDays,
  CourseDueDateReminderRecipient,
  CourseDueDateReminderWindow,
  OverdueCoursesByLanguageRow,
  OverdueCoursesEmailCourse,
} from "./course-due-date-reminder.types";

@Injectable()
export class CourseDueDateNotificationRepository {
  constructor(
    @Inject(DB) private readonly db: DatabasePg,
    private readonly localizationService: LocalizationService,
    private readonly emailService: EmailService,
  ) {}

  async findStudentsDueDatesForCourse(courseId: UUIDType, studentIds: UUIDType[]) {
    if (!studentIds.length) return [];

    return this.db
      .select({
        studentId: studentCourses.studentId,
        dueDate: sql<string | null>`TO_CHAR(${groupCourses.dueDate}, 'DD.MM.YYYY')`,
      })
      .from(studentCourses)
      .leftJoin(
        groupCourses,
        and(
          eq(groupCourses.courseId, studentCourses.courseId),
          eq(groupCourses.groupId, studentCourses.enrolledByGroupId),
        ),
      )
      .where(
        and(eq(studentCourses.courseId, courseId), inArray(studentCourses.studentId, studentIds)),
      );
  }

  async findTenantHost(tenantId: UUIDType) {
    const [tenant] = await this.db
      .select({ host: tenants.host })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    return tenant?.host ?? null;
  }

  async findCourseDueDateReminderRecipients(
    reminderWindows: CourseDueDateReminderWindow[],
  ): Promise<CourseDueDateReminderRecipient[]> {
    const globalSettings = alias(settings, "global_settings");
    const userSettings = alias(settings, "user_settings");

    const dueDateCondition = or(
      ...reminderWindows.map(
        ({ startsAt, endsAt }) =>
          sql`${groupCourses.dueDate} BETWEEN ${startsAt}::timestamptz AND ${endsAt}::timestamptz`,
      ),
    );

    if (!dueDateCondition) return [];

    return this.db
      .selectDistinct({
        studentId: users.id,
        studentEmail: users.email,
        studentFirstName: users.firstName,
        studentLastName: users.lastName,
        tenantId: users.tenantId,
        tenantHost: tenants.host,
        courseId: courses.id,
        courseAuthorId: courses.authorId,
        courseName: this.localizationService.getLocalizedSqlField(
          courses.title,
          sql<SupportedLanguages>`${userSettings.settings}->>'language'`,
        ),
        dueDate: sql<string>`${groupCourses.dueDate}`,
        daysBeforeDueDate: sql<CourseDueDateReminderDays>`CASE ${sql.join(
          reminderWindows.map(
            ({ daysBeforeDueDate, startsAt, endsAt }) =>
              sql`WHEN ${groupCourses.dueDate} BETWEEN ${startsAt}::timestamptz AND ${endsAt}::timestamptz THEN ${daysBeforeDueDate}::integer`,
          ),
          sql` `,
        )} END`,
        defaultEmailSettings: this.emailService.getDefaultEmailPropertiesSql(
          userSettings.settings,
          globalSettings.settings,
        ),
      })
      .from(groupCourses)
      .innerJoin(groupUsers, eq(groupUsers.groupId, groupCourses.groupId))
      .innerJoin(
        studentCourses,
        and(
          eq(studentCourses.courseId, groupCourses.courseId),
          eq(studentCourses.studentId, groupUsers.userId),
          eq(studentCourses.status, COURSE_ENROLLMENT.ENROLLED),
          or(
            eq(studentCourses.enrolledByGroupId, groupCourses.groupId),
            isNull(studentCourses.enrolledByGroupId),
          ),
        ),
      )
      .innerJoin(users, eq(users.id, studentCourses.studentId))
      .innerJoin(userSettings, eq(userSettings.userId, users.id))
      .leftJoin(globalSettings, isNull(globalSettings.userId))
      .innerJoin(tenants, eq(tenants.id, users.tenantId))
      .innerJoin(courses, eq(courses.id, groupCourses.courseId))
      .where(
        and(
          eq(groupCourses.isMandatory, true),
          isNotNull(groupCourses.dueDate),
          dueDateCondition,
          isNull(studentCourses.completedAt),
          isNull(users.deletedAt),
        ),
      );
  }

  async findOverdueCoursesByLanguage(
    languages: SupportedLanguages[],
  ): Promise<OverdueCoursesByLanguageRow[]> {
    if (languages.length === 0) return [];

    const requestedLanguageValues = languages.map((language) => sql`${language}`);

    const requestedLanguages = this.db.$with("requested_languages").as(
      this.db
        .select({
          language: sql<SupportedLanguages>`unnest(ARRAY[${sql.join(
            requestedLanguageValues,
            sql`, `,
          )}]::text[])`.as("language"),
        })
        .from(sql`(SELECT 1) AS language_seed`),
    );

    const requestedLanguage = sql<SupportedLanguages>`${requestedLanguages.language}`;

    const overdueRows = this.db.$with("overdue_rows").as(
      this.db
        .selectDistinct({
          language: requestedLanguages.language,
          courseId: sql<UUIDType>`${courses.id}`.as("course_id"),
          courseTitle: this.localizationService
            .getLocalizedSqlField(courses.title, requestedLanguage)
            .as("course_title"),
          groupId: sql<UUIDType>`${groups.id}`.as("group_id"),
          groupName: this.localizationService
            .getLocalizedSqlField(groups.name, requestedLanguage, groups)
            .as("group_name"),
          dueDate: sql<string>`TO_CHAR(${groupCourses.dueDate}, 'DD.MM.YYYY')`.as("due_date"),
          studentName: sql<string>`CONCAT(${users.firstName}, ' ', ${users.lastName})`.as(
            "student_name",
          ),
          studentEmail: users.email,
        })
        .from(groupCourses)
        .innerJoin(requestedLanguages, sql`true`)
        .innerJoin(courses, eq(courses.id, groupCourses.courseId))
        .innerJoin(groups, eq(groups.id, groupCourses.groupId))
        .innerJoin(
          studentCourses,
          and(
            eq(studentCourses.courseId, courses.id),
            or(
              eq(studentCourses.enrolledByGroupId, groups.id),
              and(
                eq(groupCourses.isMandatory, true),
                sql`EXISTS (
                  SELECT 1
                  FROM ${groupUsers}
                  WHERE ${groupUsers.groupId} = ${groups.id}
                    AND ${groupUsers.userId} = ${studentCourses.studentId}
                    AND ${studentCourses.enrolledByGroupId} IS NULL
                )`,
              ),
            ),
          ),
        )
        .innerJoin(users, eq(users.id, studentCourses.studentId))
        .where(
          and(
            isNotNull(groupCourses.dueDate),
            sql`${groupCourses.dueDate} < NOW()`,
            not(
              userHasAnyPermissionsCondition(this.db, users.id, users.tenantId, [
                PERMISSIONS.COURSE_UPDATE,
                PERMISSIONS.COURSE_UPDATE_OWN,
              ]),
            ),
            isNull(users.deletedAt),
            isNull(studentCourses.completedAt),
          ),
        ),
    );

    const groupSummaries = this.db.$with("group_summaries").as(
      this.db
        .select({
          language: overdueRows.language,
          courseId: overdueRows.courseId,
          courseTitle: overdueRows.courseTitle,
          groupName: overdueRows.groupName,
          dueDate: overdueRows.dueDate,
          students: sql<OverdueCoursesEmailCourse["groups"][number]["students"]>`jsonb_agg(
            jsonb_build_object(
              'name', ${overdueRows.studentName},
              'email', ${overdueRows.studentEmail}
            )
            ORDER BY ${overdueRows.studentName}, ${overdueRows.studentEmail}
          )`.as("students"),
        })
        .from(overdueRows)
        .groupBy(
          overdueRows.language,
          overdueRows.courseId,
          overdueRows.courseTitle,
          overdueRows.groupId,
          overdueRows.groupName,
          overdueRows.dueDate,
        ),
    );

    const courseSummaries = this.db.$with("course_summaries").as(
      this.db
        .select({
          language: groupSummaries.language,
          courseTitle: groupSummaries.courseTitle,
          groups: sql<OverdueCoursesEmailCourse["groups"]>`jsonb_agg(
            jsonb_build_object(
              'groupName', ${groupSummaries.groupName},
              'dueDate', ${groupSummaries.dueDate},
              'students', ${groupSummaries.students}
            )
            ORDER BY ${groupSummaries.groupName}, ${groupSummaries.dueDate}
          )`.as("groups"),
        })
        .from(groupSummaries)
        .groupBy(groupSummaries.language, groupSummaries.courseId, groupSummaries.courseTitle),
    );

    return this.db
      .with(requestedLanguages, overdueRows, groupSummaries, courseSummaries)
      .select({
        language: courseSummaries.language,
        courses: sql<OverdueCoursesEmailCourse[]>`jsonb_agg(
          jsonb_build_object(
            'courseTitle', ${courseSummaries.courseTitle},
            'groups', ${courseSummaries.groups}
          )
          ORDER BY ${courseSummaries.courseTitle}
        )`.as("courses"),
      })
      .from(courseSummaries)
      .groupBy(courseSummaries.language);
  }
}
