import { randomUUID } from "node:crypto";

import { forwardRef, Inject, Injectable } from "@nestjs/common";
import {
  buildOverdueCoursesEventFields,
  summarizeDueDateCourseTitles,
} from "@repo/email-templates";
import {
  AUTOMATION_EVENT_KINDS,
  COURSE_DUE_DATE_AT_RISK_DAYS,
  SUPPORTED_LANGUAGES,
} from "@repo/shared";
import { addDays, endOfDay, startOfDay } from "date-fns";
import { match } from "ts-pattern";

import { NotificationEvent } from "src/automation-execution/events/notification-event";
import { CourseDueDateReminderEmailEvent } from "src/events";
import { OutboxPublisher } from "src/outbox/outbox.publisher";
import { dbAls } from "src/storage/db/db-als.store";
import { UserService } from "src/user/user.service";

import { CourseDueDateNotificationRepository } from "./course-due-date-notification.repository";
import { COURSE_DUE_DATE_REMINDER_DAYS } from "./course-due-date-reminders.constants";
import { buildUnfinishedCoursesDueReportUrl } from "./course-due-date-report-link.utils";

import type {
  CourseDueDateReminderWindow,
  CourseDueDateReportRange,
  CourseDueDateWindow,
} from "./course-due-date-reminder.types";
import type { DueDateCourse } from "@repo/email-templates";
import type { SupportedLanguages } from "@repo/shared";
import type { UUIDType } from "src/common";

@Injectable()
export class CourseDueDateNotificationService {
  constructor(
    private readonly courseDueDateNotificationRepository: CourseDueDateNotificationRepository,
    private readonly outboxPublisher: OutboxPublisher,
    @Inject(forwardRef(() => UserService)) private readonly userService: UserService,
  ) {}

  async getStudentsDueDatesForCourse(
    courseId: UUIDType,
    studentIds: UUIDType[],
  ): Promise<Record<string, string | null>> {
    const rows = await this.courseDueDateNotificationRepository.findStudentsDueDatesForCourse(
      courseId,
      studentIds,
    );

    return Object.fromEntries(rows.map(({ studentId, dueDate }) => [studentId, dueDate]));
  }

  /** Tells tenant admins how many learners missed a group course due date, linking to the report. */
  async sendOverdueCoursesEmails() {
    const today = this.getTodayCalendarDay();
    const overdueRange = { firstDay: null, lastDay: this.shiftCalendarDay(today, -1) };

    const unfinishedCourses = await this.findUnfinishedCoursesDueIn(overdueRange);
    if (!unfinishedCourses) return;

    const { coursesByLanguage, coursesCount, learnersCount } = unfinishedCourses;
    const reportLink = await this.buildTenantReportLink(overdueRange);
    const overdueFields = {
      courses: coursesByLanguage,
      courses_link: reportLink,
      overdue_learners_count: learnersCount,
      overdue_courses_count: coursesCount,
      ...buildOverdueCoursesEventFields(coursesByLanguage),
    };

    const admins = await this.userService.getAdminsToNotifyAboutOverdueCourse();

    await this.outboxPublisher.publish(
      new NotificationEvent({
        occurrenceId: randomUUID(),
        kind: AUTOMATION_EVENT_KINDS.ADMIN_OVERDUE_COURSES,
        recipients: admins.map(({ email, firstName, lastName, defaultEmailSettings }) => ({
          itemId: email,
          email,
          language: defaultEmailSettings.language,
          eventFields: {
            userFirstName: firstName,
            userLastName: lastName,
            userEmail: email,
            ...overdueFields,
          },
        })),
        items: [{ itemId: this.getOriginatingTenantId(), eventFields: overdueFields }],
      }),
    );
  }

  /** Warns tenant admins once per due date, a fixed number of days before it, about unfinished courses. */
  async sendCourseDueDatesAtRiskEmails() {
    const atRiskDay = this.shiftCalendarDay(
      this.getTodayCalendarDay(),
      COURSE_DUE_DATE_AT_RISK_DAYS,
    );
    const atRiskRange = { firstDay: atRiskDay, lastDay: atRiskDay };

    const unfinishedCourses = await this.findUnfinishedCoursesDueIn(atRiskRange);
    if (!unfinishedCourses) return;

    const { coursesByLanguage, coursesCount, learnersCount } = unfinishedCourses;
    const reportLink = await this.buildTenantReportLink(atRiskRange);
    const admins = await this.userService.getAdminsToNotifyAboutOverdueCourse();

    await this.outboxPublisher.publish(
      new NotificationEvent({
        occurrenceId: randomUUID(),
        kind: AUTOMATION_EVENT_KINDS.ADMIN_COURSE_DUE_DATES_AT_RISK,
        recipients: admins.map(({ email, firstName, lastName, defaultEmailSettings }) => {
          const { language } = defaultEmailSettings;

          return {
            itemId: email,
            email,
            language,
            eventFields: {
              userFirstName: firstName,
              userLastName: lastName,
              userEmail: email,
              at_risk_courses_summary: summarizeDueDateCourseTitles(
                this.pickCoursesInLanguage(coursesByLanguage, language),
                language,
              ),
              at_risk_learners_count: learnersCount,
              at_risk_courses_count: coursesCount,
              report_link: reportLink,
            },
          };
        }),
      }),
    );
  }

  /** Reminds enrolled learners about mandatory group courses due in one of the reminder windows. */
  async sendCourseDueDateReminders() {
    const recipients =
      await this.courseDueDateNotificationRepository.findCourseDueDateReminderRecipients(
        this.buildReminderWindows(),
      );

    if (!recipients.length) return;

    await this.outboxPublisher.publish(new CourseDueDateReminderEmailEvent({ recipients }));
  }

  private async findUnfinishedCoursesDueIn(dueDateRange: CourseDueDateReportRange) {
    const dueDateWindow = this.toDueDateWindow(dueDateRange);

    const coursesByLanguageRows =
      await this.courseDueDateNotificationRepository.findCoursesDueInWindowByLanguage(
        Object.values(SUPPORTED_LANGUAGES),
        dueDateWindow,
      );

    const [anyLanguageRow] = coursesByLanguageRows;
    if (!anyLanguageRow?.courses.length) return null;

    const learnersCount =
      await this.courseDueDateNotificationRepository.countLearnersWithCoursesDueInWindow(
        dueDateWindow,
      );

    return {
      coursesByLanguage: Object.fromEntries(
        coursesByLanguageRows.map(({ language, courses }) => [language, courses]),
      ) as Partial<Record<SupportedLanguages, DueDateCourse[]>>,
      coursesCount: anyLanguageRow.courses.length,
      learnersCount,
    };
  }

  private pickCoursesInLanguage(
    coursesByLanguage: Partial<Record<SupportedLanguages, DueDateCourse[]>>,
    language: SupportedLanguages,
  ) {
    return coursesByLanguage[language] ?? coursesByLanguage[SUPPORTED_LANGUAGES.EN] ?? [];
  }

  private async buildTenantReportLink(dueDateRange: CourseDueDateReportRange) {
    const tenantHost = await this.courseDueDateNotificationRepository.findTenantHost(
      this.getOriginatingTenantId(),
    );

    if (!tenantHost) {
      throw new Error("Course due date notification tenant was not found");
    }

    return buildUnfinishedCoursesDueReportUrl(tenantHost, dueDateRange);
  }

  private getOriginatingTenantId() {
    const tenantId = dbAls.getStore()?.tenantId;

    if (!tenantId) {
      throw new Error("Course due date notifications require an originating tenant");
    }

    return tenantId;
  }

  /** Report days are whole UTC days, so the window starts and ends at UTC midnight. */
  private toDueDateWindow({ firstDay, lastDay }: CourseDueDateReportRange): CourseDueDateWindow {
    return {
      dueFrom: match(firstDay)
        .with(null, () => null)
        .otherwise((calendarDay) => this.startOfCalendarDay(calendarDay)),
      dueBefore: this.startOfCalendarDay(this.shiftCalendarDay(lastDay, 1)),
    };
  }

  private getTodayCalendarDay() {
    return new Date().toISOString().slice(0, 10);
  }

  private shiftCalendarDay(calendarDay: string, days: number) {
    return addDays(this.startOfCalendarDay(calendarDay), days).toISOString().slice(0, 10);
  }

  private startOfCalendarDay(calendarDay: string) {
    return new Date(`${calendarDay}T00:00:00.000Z`);
  }

  private buildReminderWindows(): CourseDueDateReminderWindow[] {
    return COURSE_DUE_DATE_REMINDER_DAYS.map((daysBeforeDueDate) => {
      const reminderDate = addDays(new Date(), daysBeforeDueDate);

      return {
        daysBeforeDueDate,
        startsAt: startOfDay(reminderDate).toISOString(),
        endsAt: endOfDay(reminderDate).toISOString(),
      };
    });
  }
}
