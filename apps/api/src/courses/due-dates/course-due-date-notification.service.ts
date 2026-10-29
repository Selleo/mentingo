import { randomUUID } from "node:crypto";

import { forwardRef, Inject, Injectable } from "@nestjs/common";
import { buildOverdueCoursesEventFields } from "@repo/email-templates";
import { AUTOMATION_EVENT_KINDS, SUPPORTED_LANGUAGES } from "@repo/shared";
import { addDays, endOfDay, startOfDay } from "date-fns";

import { NotificationEvent } from "src/automation-execution/events/notification-event";
import { CourseDueDateReminderEmailEvent } from "src/events";
import { OutboxPublisher } from "src/outbox/outbox.publisher";
import { dbAls } from "src/storage/db/db-als.store";
import { UserService } from "src/user/user.service";

import { CourseDueDateNotificationRepository } from "./course-due-date-notification.repository";
import { COURSE_DUE_DATE_REMINDER_DAYS } from "./course-due-date-reminders.constants";

import type { CourseDueDateReminderWindow } from "./course-due-date-reminder.types";
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

  /** Notifies tenant admins about learners who missed a mandatory group course due date. */
  async sendOverdueCoursesEmails() {
    const adminsToNotify = await this.userService.getAdminsToNotifyAboutOverdueCourse();

    const overdueCoursesByLanguage =
      await this.courseDueDateNotificationRepository.findOverdueCoursesByLanguage(
        Object.values(SUPPORTED_LANGUAGES),
      );

    if (overdueCoursesByLanguage.length === 0) return;

    const localizedCollections = Object.fromEntries(
      overdueCoursesByLanguage.map(({ language, courses }) => [language, courses]),
    );
    const localizedSummary = buildOverdueCoursesEventFields(localizedCollections);

    const recipients = adminsToNotify.flatMap(
      ({ email, firstName, lastName, tenantHost, defaultEmailSettings }) => {
        const coursesForLanguage = localizedCollections[defaultEmailSettings.language];
        if (!coursesForLanguage?.length) return [];

        return [
          {
            itemId: email,
            email,
            language: defaultEmailSettings.language,
            eventFields: {
              userFirstName: firstName,
              userLastName: lastName,
              userEmail: email,
              courses: localizedCollections,
              courses_link: this.buildAdminCoursesUrl(tenantHost),
              ...localizedSummary,
            },
          },
        ];
      },
    );

    const tenantId = dbAls.getStore()?.tenantId;

    if (!tenantId) {
      throw new Error("Overdue course notifications require an originating tenant");
    }

    const tenantHost = await this.courseDueDateNotificationRepository.findTenantHost(tenantId);

    if (!tenantHost) {
      throw new Error("Overdue course notification tenant was not found");
    }

    await this.outboxPublisher.publish(
      new NotificationEvent(
        randomUUID(),
        AUTOMATION_EVENT_KINDS.ADMIN_OVERDUE_COURSES,
        recipients,
        [
          {
            itemId: tenantId,
            eventFields: {
              courses: localizedCollections,
              courses_link: this.buildAdminCoursesUrl(tenantHost),
              ...localizedSummary,
            },
          },
        ],
      ),
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

  private buildAdminCoursesUrl(tenantHost: string) {
    return `${tenantHost.replace(/\/$/, "")}/admin/courses`;
  }
}
