import { BadRequestException, Injectable } from "@nestjs/common";
import { CALENDAR_EVENT_STATUSES, SUPPORTED_LANGUAGES } from "@repo/shared";
import { inArray, or, sql, type SQL } from "drizzle-orm";

import { buildJsonbFieldWithMultipleEntries, mergeJsonbField } from "src/common/helpers/sqlHelpers";
import { calendarEvents } from "src/storage/schema";

import type { DatabasePg, UUIDType } from "src/common";
import type {
  CancelDueDateCalendarEventsInput,
  GroupCourseDueDateCalendarCourse,
  UpsertDueDateCalendarEventInput,
  UpsertDueDateCalendarEventsInput,
} from "src/courses/types/group-course-due-date-calendar.types";

@Injectable()
export class GroupCourseDueDateCalendarService {
  async upsertDueDateCalendarEvent(dbInstance: DatabasePg, input: UpsertDueDateCalendarEventInput) {
    const syncedCalendarEventIdsByGroupId = await this.upsertDueDateCalendarEvents(dbInstance, [
      input,
    ]);

    return syncedCalendarEventIdsByGroupId.get(input.groupId) ?? null;
  }

  async upsertDueDateCalendarEvents(
    dbInstance: DatabasePg,
    inputs: UpsertDueDateCalendarEventsInput,
  ) {
    const eligibleInputs = inputs.filter((input) => input.isMandatory && input.dueDate);

    if (!eligibleInputs.length) return new Map<UUIDType, UUIDType>();

    const calendarEventValues = eligibleInputs.map((input) => {
      const calendarEventFields = this.buildCalendarEventFields(input);

      return {
        groupId: input.groupId,
        uid: calendarEventFields.uid,
        calendarEvent: {
          ...calendarEventFields,
          title: this.buildTitleInsert(input.course),
        },
      };
    });

    const syncedCalendarEvents = await dbInstance
      .insert(calendarEvents)
      .values(calendarEventValues.map(({ calendarEvent }) => calendarEvent))
      .onConflictDoUpdate({
        target: calendarEvents.uid,
        set: {
          status: sql`EXCLUDED.status`,
          baseLanguage: sql`EXCLUDED.base_language`,
          availableLocales: sql`EXCLUDED.available_locales`,
          title: mergeJsonbField(calendarEvents.title, sql`EXCLUDED.title`),
          startsAt: sql`EXCLUDED.starts_at`,
          endsAt: sql`EXCLUDED.ends_at`,
          allDay: sql`EXCLUDED.all_day`,
          timezone: sql`EXCLUDED.timezone`,
          location: sql`EXCLUDED.location`,
          organizerUserId: sql`EXCLUDED.organizer_user_id`,
          rrule: sql`EXCLUDED.rrule`,
          exdates: sql`EXCLUDED.exdates`,
          deletedAt: sql`EXCLUDED.deleted_at`,
          sequence: sql`${calendarEvents.sequence} + 1`,
          updatedAt: sql`CURRENT_TIMESTAMP`,
        },
      })
      .returning({ id: calendarEvents.id, uid: calendarEvents.uid });

    const groupIdByUid = new Map(
      calendarEventValues.map(({ groupId, uid }) => [uid, groupId] as const),
    );

    return new Map(
      syncedCalendarEvents.map((calendarEvent) => {
        const groupId = groupIdByUid.get(calendarEvent.uid);

        if (!groupId) {
          throw new BadRequestException("calendarView.errors.courseDueDateCalendarSyncFailed");
        }

        return [groupId, calendarEvent.id] as const;
      }),
    );
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
