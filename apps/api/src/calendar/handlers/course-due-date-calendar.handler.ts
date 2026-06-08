import { EventsHandler, type IEventHandler } from "@nestjs/cqrs";

import { CourseDueDateCalendarService } from "src/calendar/course-due-date-calendar.service";
import { GroupCourseDueDatesRemovedEvent, GroupCourseDueDatesSyncedEvent } from "src/events";

type EventType = GroupCourseDueDatesSyncedEvent | GroupCourseDueDatesRemovedEvent;

const CourseDueDateCalendarEvents = [
  GroupCourseDueDatesSyncedEvent,
  GroupCourseDueDatesRemovedEvent,
];

@EventsHandler(...CourseDueDateCalendarEvents)
export class CourseDueDateCalendarHandler implements IEventHandler<EventType> {
  constructor(private readonly courseDueDateCalendarService: CourseDueDateCalendarService) {}

  async handle(event: EventType) {
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
