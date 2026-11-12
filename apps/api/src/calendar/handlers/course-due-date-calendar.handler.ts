import { CourseDueDateCalendarService } from "src/calendar/services/course-due-date-calendar.service";
import { GroupCourseDueDatesRemovedEvent, GroupCourseDueDatesSyncedEvent } from "src/events";
import { OutboxEventsHandler } from "src/outbox/outbox.decorators";

import type { OutboxEventsHandlerOf } from "src/outbox/outbox.types";

type EventType = GroupCourseDueDatesSyncedEvent | GroupCourseDueDatesRemovedEvent;

const CourseDueDateCalendarEvents = [
  GroupCourseDueDatesSyncedEvent,
  GroupCourseDueDatesRemovedEvent,
];

@OutboxEventsHandler(...CourseDueDateCalendarEvents)
export class CourseDueDateCalendarHandler implements OutboxEventsHandlerOf<EventType> {
  constructor(private readonly courseDueDateCalendarService: CourseDueDateCalendarService) {}

  async handleOutboxEvent(event: EventType) {
    if (event instanceof GroupCourseDueDatesSyncedEvent) {
      const { courseId, groupIds } = event.groupCourseDueDatesSyncedData;

      await this.courseDueDateCalendarService.syncGroupCourseDueDates(courseId, groupIds);
    }

    if (event instanceof GroupCourseDueDatesRemovedEvent) {
      const { groups } = event.groupCourseDueDatesRemovedData;

      await this.courseDueDateCalendarService.removeGroupCourseDueDates(
        groups.map((group) => group.calendarEventId),
      );
    }
  }
}
