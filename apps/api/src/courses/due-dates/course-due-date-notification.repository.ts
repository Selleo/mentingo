import { Inject, Injectable } from "@nestjs/common";
import { COURSE_ENROLLMENT, PERMISSIONS, type SupportedLanguages } from "@repo/shared";
import { and, eq, exists, gte, inArray, isNotNull, isNull, lt, not, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { DatabasePg, type UUIDType } from "src/common";
import { EmailService } from "src/common/emails/emails.service";
import { userHasAnyPermissionsCondition } from "src/common/permissions/permission-sql.utils";
import { LocalizationService } from "src/localization/localization.service";
import { DB } from "src/storage/db/db.providers";
import {
  courses,
  groupCourses,
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
  CourseDueDateWindow,
  DueDateCoursesByLanguageRow,
} from "./course-due-date-reminder.types";
import type { DueDateCourse } from "@repo/email-templates";

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

  async findCoursesDueInWindowByLanguage(
    languages: SupportedLanguages[],
    dueDateWindow: CourseDueDateWindow,
  ): Promise<DueDateCoursesByLanguageRow[]> {
    if (languages.length === 0) return [];

    const requestedLanguages = this.db.$with("requested_languages").as(
      this.db
        .select({
          language: sql<SupportedLanguages>`unnest(ARRAY[${sql.join(
            languages.map((language) => sql`${language}`),
            sql`, `,
          )}]::text[])`.as("language"),
        })
        .from(sql`(SELECT 1) AS language_seed`),
    );

    const unfinishedLearnerCourses = this.db
      .$with("unfinished_learner_courses")
      .as(this.selectUnfinishedLearnerCoursesDueIn(dueDateWindow));

    const courseLearnerCounts = this.db.$with("course_learner_counts").as(
      this.db
        .select({
          courseId: unfinishedLearnerCourses.courseId,
          learnersCount: sql<number>`COUNT(*)::int`.as("learners_count"),
        })
        .from(unfinishedLearnerCourses)
        .groupBy(unfinishedLearnerCourses.courseId),
    );

    const courseTitle = this.localizationService.getLocalizedSqlField(
      courses.title,
      sql<SupportedLanguages>`${requestedLanguages.language}`,
    );

    return this.db
      .with(requestedLanguages, unfinishedLearnerCourses, courseLearnerCounts)
      .select({
        language: requestedLanguages.language,
        courses: sql<DueDateCourse[]>`jsonb_agg(
          jsonb_build_object(
            'courseTitle', ${courseTitle},
            'learnersCount', ${courseLearnerCounts.learnersCount}
          )
          ORDER BY ${courseLearnerCounts.learnersCount} DESC, ${courseTitle}
        )`.as("courses"),
      })
      .from(courseLearnerCounts)
      .innerJoin(courses, eq(courses.id, courseLearnerCounts.courseId))
      .innerJoin(requestedLanguages, sql`true`)
      .groupBy(requestedLanguages.language);
  }

  async countLearnersWithCoursesDueInWindow(dueDateWindow: CourseDueDateWindow): Promise<number> {
    const unfinishedLearnerCourses = this.db
      .$with("unfinished_learner_courses")
      .as(this.selectUnfinishedLearnerCoursesDueIn(dueDateWindow));

    const [result] = await this.db
      .with(unfinishedLearnerCourses)
      .select({
        learnersCount: sql<number>`COUNT(DISTINCT ${unfinishedLearnerCourses.learnerId})::int`,
      })
      .from(unfinishedLearnerCourses);

    return result?.learnersCount ?? 0;
  }

  /**
   * Learners who still have to finish a course whose group due date falls in the window: either the
   * group enrolled them, or the course is mandatory for a group they belong to. Course editors are
   * left out because they are not expected to complete courses.
   */
  private selectUnfinishedLearnerCoursesDueIn({ dueFrom, dueBefore }: CourseDueDateWindow) {
    const isGroupMember = exists(
      this.db
        .select({ userId: groupUsers.userId })
        .from(groupUsers)
        .where(
          and(
            eq(groupUsers.groupId, groupCourses.groupId),
            eq(groupUsers.userId, studentCourses.studentId),
          ),
        ),
    );

    return this.db
      .selectDistinct({
        courseId: sql<UUIDType>`${studentCourses.courseId}`.as("course_id"),
        learnerId: sql<UUIDType>`${studentCourses.studentId}`.as("learner_id"),
      })
      .from(groupCourses)
      .innerJoin(courses, and(eq(courses.id, groupCourses.courseId), eq(courses.isArchived, false)))
      .innerJoin(
        studentCourses,
        and(
          eq(studentCourses.courseId, groupCourses.courseId),
          eq(studentCourses.status, COURSE_ENROLLMENT.ENROLLED),
          isNull(studentCourses.completedAt),
          or(
            eq(studentCourses.enrolledByGroupId, groupCourses.groupId),
            and(
              eq(groupCourses.isMandatory, true),
              isNull(studentCourses.enrolledByGroupId),
              isGroupMember,
            ),
          ),
        ),
      )
      .innerJoin(users, and(eq(users.id, studentCourses.studentId), isNull(users.deletedAt)))
      .where(
        and(
          isNotNull(groupCourses.dueDate),
          dueFrom ? gte(groupCourses.dueDate, dueFrom) : undefined,
          lt(groupCourses.dueDate, dueBefore),
          not(
            userHasAnyPermissionsCondition(this.db, users.id, users.tenantId, [
              PERMISSIONS.COURSE_UPDATE,
              PERMISSIONS.COURSE_UPDATE_OWN,
            ]),
          ),
        ),
      );
  }
}
