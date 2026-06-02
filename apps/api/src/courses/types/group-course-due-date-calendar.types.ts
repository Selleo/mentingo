import type { LocalizedText, SupportedLanguages } from "@repo/shared";
import type { UUIDType } from "src/common";

export type GroupCourseDueDateCalendarCourse = {
  title: LocalizedText;
  baseLanguage: SupportedLanguages;
  availableLocales: SupportedLanguages[];
};

export type UpsertDueDateCalendarEventInput = {
  course: GroupCourseDueDateCalendarCourse;
  courseId: UUIDType;
  groupId: UUIDType;
  dueDate: Date | null;
  isMandatory: boolean;
};

export type CancelDueDateCalendarEventsInput = {
  calendarEventIds: UUIDType[];
  calendarEventUids: string[];
};
