import { BadRequestException, Injectable } from "@nestjs/common";
import { CALENDAR_EVENT_STATUSES, SUPPORTED_LANGUAGES } from "@repo/shared";
import { inArray, or, sql, type SQL } from "drizzle-orm";

import { buildJsonbFieldWithMultipleEntries, setJsonbField } from "src/common/helpers/sqlHelpers";
import { calendarEvents } from "src/storage/schema";

import type { DatabasePg, UUIDType } from "src/common";
import type {
  CancelDueDateCalendarEventsInput,
  GroupCourseDueDateCalendarCourse,
  UpsertDueDateCalendarEventInput,
} from "src/courses/types/group-course-due-date-calendar.types";

@Injectable()
export class GroupCourseDueDateCalendarService {
  async upsertDueDateCalendarEvent(dbInstance: DatabasePg, input: UpsertDueDateCalendarEventInput) {
    if (!input.isMandatory || !input.dueDate) return null;

    const calendarEventFields = this.buildCalendarEventFields(input);
    const [syncedCalendarEvent] = await dbInstance
      .insert(calendarEvents)
      .values({
        ...calendarEventFields,
        title: this.buildTitleInsert(input.course),
      })
      .onConflictDoUpdate({
        target: calendarEvents.uid,
        set: {
          ...calendarEventFields,
          sequence: sql`${calendarEvents.sequence} + 1`,
          title: this.buildTitleUpdate(input.course),
          updatedAt: sql`CURRENT_TIMESTAMP`,
        },
      })
      .returning({ id: calendarEvents.id });

    return syncedCalendarEvent.id;
  }

  async cancelDueDateCalendarEvents(
    dbInstance: DatabasePg,
    input: CancelDueDateCalendarEventsInput,
  ) {
    const removeCondition = this.getRemoveCondition(input);

    if (!removeCondition) return;

    await dbInstance
      .update(calendarEvents)
      .set({
        status: CALENDAR_EVENT_STATUSES.CANCELLED,
        deletedAt: new Date().toISOString(),
      })
      .where(removeCondition);
  }

  getUid(courseId: UUIDType, groupId: UUIDType) {
    return `course-due-date:${courseId}:${groupId}`;
  }

  private buildCalendarEventFields(input: UpsertDueDateCalendarEventInput) {
    if (!input.dueDate) {
      throw new BadRequestException("calendarView.errors.courseDueDateRequired");
    }

    const { startsAt, endsAt } = this.getAllDayUtcRange(input.dueDate);

    return {
      uid: this.getUid(input.courseId, input.groupId),
      sequence: 0,
      status: CALENDAR_EVENT_STATUSES.SCHEDULED,
      baseLanguage: input.course.baseLanguage ?? SUPPORTED_LANGUAGES.EN,
      availableLocales: input.course.availableLocales ?? [SUPPORTED_LANGUAGES.EN],
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

  private buildTitleInsert(course: GroupCourseDueDateCalendarCourse): SQL {
    const titleEntries = this.getTitleEntries(course);

    if (!titleEntries.length) {
      throw new BadRequestException("calendarView.errors.courseTitleRequired");
    }

    return buildJsonbFieldWithMultipleEntries(
      Object.fromEntries(titleEntries.map(({ language, title }) => [language, title])),
    );
  }

  private buildTitleUpdate(course: GroupCourseDueDateCalendarCourse): SQL {
    const title = this.getTitleEntries(course).reduce<SQL | undefined>(
      (localizedTitle, titleEntry) =>
        setJsonbField(
          localizedTitle ?? calendarEvents.title,
          titleEntry.language,
          titleEntry.title,
        ) ?? localizedTitle,
      undefined,
    );

    if (!title) throw new BadRequestException("calendarView.errors.courseTitleRequired");

    return title;
  }

  private getTitleEntries(course: GroupCourseDueDateCalendarCourse) {
    const baseLanguage = course.baseLanguage ?? SUPPORTED_LANGUAGES.EN;

    const languages = [
      baseLanguage,
      ...(course.availableLocales ?? []),
      ...(Object.keys(course.title) as Array<keyof typeof course.title>),
    ];

    const uniqueLanguages = [...new Set(languages)];

    return uniqueLanguages
      .map((language) => ({
        language,
        title: course.title[language],
      }))
      .filter(
        (
          titleEntry,
        ): titleEntry is {
          language: GroupCourseDueDateCalendarCourse["baseLanguage"];
          title: string;
        } => Boolean(titleEntry.title),
      );
  }

  private getRemoveCondition(input: CancelDueDateCalendarEventsInput) {
    const conditions: SQL[] = [];

    if (input.calendarEventIds.length) {
      conditions.push(inArray(calendarEvents.id, input.calendarEventIds));
    }

    if (input.calendarEventUids.length) {
      conditions.push(inArray(calendarEvents.uid, input.calendarEventUids));
    }

    if (!conditions.length) return null;
    if (conditions.length === 1) return conditions[0];

    return or(...conditions);
  }

  private getAllDayUtcRange(dueDate: Date) {
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
