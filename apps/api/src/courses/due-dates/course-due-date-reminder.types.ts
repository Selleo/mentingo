import type { COURSE_DUE_DATE_REMINDER_DAYS } from "./course-due-date-reminders.constants";
import type { DueDateCourse } from "@repo/email-templates";
import type { SupportedLanguages } from "@repo/shared";
import type { UUIDType } from "src/common";
import type { DefaultEmailSettings } from "src/events/types";

export type CourseDueDateReminderDays = (typeof COURSE_DUE_DATE_REMINDER_DAYS)[number];

export type CourseDueDateReminderRecipient = {
  studentId: UUIDType;
  studentEmail: string;
  studentFirstName: string;
  studentLastName: string;
  tenantId: UUIDType;
  tenantHost: string;
  courseId: UUIDType;
  courseAuthorId: UUIDType;
  courseName: string;
  dueDate: string;
  daysBeforeDueDate: CourseDueDateReminderDays;
  defaultEmailSettings: DefaultEmailSettings;
};

export type CourseDueDateReminderWindow = {
  daysBeforeDueDate: CourseDueDateReminderDays;
  startsAt: string;
  endsAt: string;
};

export type DueDateCoursesByLanguageRow = {
  language: SupportedLanguages;
  courses: DueDateCourse[];
};

/** Due dates on or after `dueFrom` (when given) and strictly before `dueBefore`. */
export type CourseDueDateWindow = {
  dueFrom: Date | null;
  dueBefore: Date;
};

/** Inclusive calendar days, in the report's `YYYY-MM-DD` form. */
export type CourseDueDateReportRange = {
  firstDay: string | null;
  lastDay: string;
};
