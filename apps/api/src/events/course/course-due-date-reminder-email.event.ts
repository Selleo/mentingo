import type { CourseDueDateReminderRecipient } from "src/courses/due-dates/course-due-date-reminder.types";

type CourseDueDateReminderEmailData = {
  recipients: CourseDueDateReminderRecipient[];
};

export class CourseDueDateReminderEmailEvent {
  constructor(public readonly courseDueDateReminderEmailData: CourseDueDateReminderEmailData) {}
}
