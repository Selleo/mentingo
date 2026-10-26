import type { COURSE_DUE_DATE_REMINDER_DAYS } from "./course-due-date-reminders.constants";
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

export type OverdueCoursesEmailCourse = {
  courseTitle: string;
  groups: {
    groupName: string;
    dueDate: string;
    students: {
      name: string;
      email: string;
    }[];
  }[];
};

export type OverdueCoursesByLanguageRow = {
  language: SupportedLanguages;
  courses: OverdueCoursesEmailCourse[];
};
