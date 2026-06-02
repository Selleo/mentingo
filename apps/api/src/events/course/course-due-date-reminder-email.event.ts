import type { CourseDueDateReminderRecipient } from "src/courses/types/course-due-date-reminder.types";

type CourseDueDateReminderEmailData = {
  recipients: CourseDueDateReminderRecipient[];
};

export class CourseDueDateReminderEmailEvent {
  constructor(public readonly courseDueDateReminderEmailData: CourseDueDateReminderEmailData) {}
}
