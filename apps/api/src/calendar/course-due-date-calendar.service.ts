import { Injectable } from "@nestjs/common";
import { CALENDAR_EVENT_STATUSES, SUPPORTED_LANGUAGES } from "@repo/shared";

import { CalendarRepository } from "./calendar.repository";

import type { CalendarEventInsert, GroupCourseDueDateRow } from "./calendar.types";
import type { UUIDType } from "src/common";

@Injectable()
export class CourseDueDateCalendarService {
  constructor(private readonly calendarRepository: CalendarRepository) {}

  async syncGroupCourseDueDates(courseId: UUIDType, groupIds: UUIDType[]) {
    const groupCourses = await this.calendarRepository.getGroupCourseDueDateRows(
      courseId,
      groupIds,
    );

    for (const groupCourse of groupCourses) {
      await this.syncGroupCourseDueDate(groupCourse);
    }
  }

  async removeGroupCourseDueDates(calendarEventIds: Array<UUIDType | null>) {
    const removableCalendarEventIds = calendarEventIds.filter((id): id is UUIDType => Boolean(id));

    await this.calendarRepository.removeCourseDueDateCalendarEvents(removableCalendarEventIds);
  }

  private async syncGroupCourseDueDate(groupCourse: GroupCourseDueDateRow) {
    const calendarEvent = this.buildCalendarEvent(groupCourse);

    await this.calendarRepository.upsertCourseDueDateCalendarEvent({
      calendarEvent,
      courseId: groupCourse.courseId,
      groupId: groupCourse.groupId,
    });
  }

  private buildCalendarEvent(groupCourse: GroupCourseDueDateRow): CalendarEventInsert {
    const { startsAt, endsAt } = this.getAllDayUtcRange(groupCourse.dueDate);
    const { baseLanguage, availableLocales } = this.getCourseLanguages(groupCourse);

    return {
      uid: this.getUid(groupCourse.courseId, groupCourse.groupId),
      sequence: 0,
      status: CALENDAR_EVENT_STATUSES.SCHEDULED,
      baseLanguage,
      availableLocales,
      title: groupCourse.courseTitle,
      description: null,
      startsAt,
      endsAt,
      allDay: true,
      timezone: "UTC",
      location: null,
      organizerUserId: null,
      rrule: null,
      exdates: null,
      deletedAt: null,
    };
  }

  private getCourseLanguages(groupCourse: GroupCourseDueDateRow) {
    return {
      baseLanguage: groupCourse.courseBaseLanguage ?? SUPPORTED_LANGUAGES.EN,
      availableLocales: groupCourse.courseAvailableLocales ?? [SUPPORTED_LANGUAGES.EN],
    };
  }

  private getUid(courseId: UUIDType, groupId: UUIDType) {
    return `course-due-date:${courseId}:${groupId}`;
  }

  private getAllDayUtcRange(dueDate: string) {
    const startsAt = new Date(dueDate);
    startsAt.setUTCHours(0, 0, 0, 0);

    const endsAt = new Date(startsAt);
    endsAt.setUTCDate(endsAt.getUTCDate() + 1);

    return {
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
    };
  }
}
