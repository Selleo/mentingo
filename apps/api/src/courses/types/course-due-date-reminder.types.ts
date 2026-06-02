import type { COURSE_DUE_DATE_REMINDER_DAYS } from "../constants/course-due-date-reminders.constants";
import type { UUIDType } from "src/common";
import type { DefaultEmailSettings } from "src/events/types";

export type CourseDueDateReminderDays = (typeof COURSE_DUE_DATE_REMINDER_DAYS)[number];

export type CourseDueDateReminderRecipient = {
  studentId: UUIDType;
  studentEmail: string;
  tenantId: UUIDType;
  tenantHost: string;
  courseId: UUIDType;
  courseAuthorId: UUIDType;
  courseName: string;
  dueDate: string;
  daysBeforeDueDate: CourseDueDateReminderDays;
  defaultEmailSettings: DefaultEmailSettings;
};
