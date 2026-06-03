import { Inject, Injectable } from "@nestjs/common";
import {
  CALENDAR_EVENT_STATUSES,
  CALENDAR_EVENT_SOURCE_TYPES,
  ENTITY_TYPES,
  LIVE_TRAINING_LINK_ENTITY_TYPES,
} from "@repo/shared";
import { and, desc, eq, inArray, sql } from "drizzle-orm";

import { DatabasePg, type UUIDType } from "src/common";
import { LocalizationService } from "src/localization/localization.service";
import { DB } from "src/storage/db/db.providers";
import {
  calendarEvents,
  courses,
  groupCourses,
  groups,
  liveTrainingLinks,
  liveTrainingMembers,
  liveTrainingSessions,
  liveTrainings,
  resourceEntity,
  resources,
  users,
} from "src/storage/schema";

import type {
  CalendarEventListConditions,
  CalendarEventNormalizedRow,
  CalendarEventInsert,
  CourseDueDateCalendarEventPayload,
  GroupCourseDueDateRow,
  LiveTrainingCalendarEventPayload,
} from "./calendar.types";
import type { CalendarEventDetails } from "./schemas/calendar-event-details.schema";
import type { CalendarEventListItem } from "./schemas/calendar-event-list.schema";
import type {
  CalendarEventStatus,
  CalendarEventSourceType,
  LocalizedText,
  LiveTrainingResourceRelationshipType,
  SupportedLanguages,
} from "@repo/shared";

@Injectable()
export class CalendarRepository {
  constructor(
    @Inject(DB) private readonly db: DatabasePg,
    private readonly localizationService: LocalizationService,
  ) {}

  async getLiveTrainingCalendarEventRows(
    conditions: CalendarEventListConditions,
    language: SupportedLanguages,
  ): Promise<CalendarEventNormalizedRow[]> {
    const liveTrainingEvents = this.getLiveTrainingEventsCte(conditions, language);

    return this.db
      .with(liveTrainingEvents)
      .select()
      .from(liveTrainingEvents)
      .orderBy(liveTrainingEvents.startsAt);
  }

  async getCourseDueDateCalendarEventRows(
    conditions: CalendarEventListConditions,
    language: SupportedLanguages,
  ): Promise<(CalendarEventListItem & CalendarEventDetails)[]> {
    const courseDueDateEvents = this.getCourseDueDateEventsCte(conditions, language);

    return this.db
      .with(courseDueDateEvents)
      .select()
      .from(courseDueDateEvents)
      .orderBy(courseDueDateEvents.startsAt);
  }

  async getGroupCourseDueDateRows(
    courseId: UUIDType,
    groupIds: UUIDType[],
  ): Promise<GroupCourseDueDateRow[]> {
    if (!groupIds.length) return [];

    return this.db
      .select({
        courseId: groupCourses.courseId,
        groupId: groupCourses.groupId,
        dueDate: sql<string>`${groupCourses.dueDate}`,
        calendarEventId: groupCourses.calendarEventId,
        courseTitle: sql<LocalizedText>`${courses.title}`,
        courseBaseLanguage: sql<SupportedLanguages>`${courses.baseLanguage}`,
        courseAvailableLocales: sql<SupportedLanguages[]>`${courses.availableLocales}`,
      })
      .from(groupCourses)
      .innerJoin(courses, eq(courses.id, groupCourses.courseId))
      .where(
        and(
          eq(groupCourses.courseId, courseId),
          inArray(groupCourses.groupId, groupIds),
          eq(groupCourses.isMandatory, true),
          sql`${groupCourses.dueDate} IS NOT NULL`,
        ),
      );
  }

  async createCourseDueDateCalendarEvent(input: {
    calendarEvent: CalendarEventInsert;
    courseId: UUIDType;
    groupId: UUIDType;
  }) {
    return this.upsertCourseDueDateCalendarEvent(input);
  }

  async upsertCourseDueDateCalendarEvent(input: {
    calendarEvent: CalendarEventInsert;
    courseId: UUIDType;
    groupId: UUIDType;
  }) {
    return this.db.transaction(async (trx) => {
      const [calendarEvent] = await trx
        .insert(calendarEvents)
        .values(input.calendarEvent)
        .onConflictDoUpdate({
          target: calendarEvents.uid,
          set: {
            ...input.calendarEvent,
            sequence: sql`${calendarEvents.sequence} + 1`,
            updatedAt: sql`CURRENT_TIMESTAMP`,
          },
        })
        .returning({ id: calendarEvents.id });

      await trx
        .update(groupCourses)
        .set({ calendarEventId: calendarEvent.id })
        .where(
          and(eq(groupCourses.courseId, input.courseId), eq(groupCourses.groupId, input.groupId)),
        );

      return calendarEvent.id;
    });
  }

  async updateCourseDueDateCalendarEvent(calendarEventId: UUIDType, input: CalendarEventInsert) {
    return this.db
      .update(calendarEvents)
      .set({
        ...input,
        sequence: sql`${calendarEvents.sequence} + 1`,
      })
      .where(eq(calendarEvents.id, calendarEventId));
  }

  async removeCourseDueDateCalendarEvents(calendarEventIds: UUIDType[]) {
    if (!calendarEventIds.length) return;

    await this.db.transaction(async (trx) => {
      await trx
        .update(groupCourses)
        .set({ calendarEventId: null })
        .where(inArray(groupCourses.calendarEventId, calendarEventIds));

      await trx
        .update(calendarEvents)
        .set({
          status: CALENDAR_EVENT_STATUSES.CANCELLED,
          deletedAt: new Date().toISOString(),
        })
        .where(inArray(calendarEvents.id, calendarEventIds));
    });
  }

  async getLiveTrainingLinkedCourseRows(eventIds: UUIDType[], language: SupportedLanguages) {
    return this.db
      .select({
        eventId: calendarEvents.id,
        courseId: courses.id,
        courseTitle: this.localizationService.getLocalizedSqlField(courses.title, language),
      })
      .from(calendarEvents)
      .innerJoin(liveTrainings, eq(liveTrainings.calendarEventId, calendarEvents.id))
      .innerJoin(liveTrainingLinks, eq(liveTrainingLinks.liveTrainingId, liveTrainings.id))
      .innerJoin(courses, eq(courses.id, liveTrainingLinks.entityId))
      .where(
        and(
          inArray(calendarEvents.id, eventIds),
          eq(liveTrainingLinks.entityType, LIVE_TRAINING_LINK_ENTITY_TYPES.COURSE),
        ),
      );
  }

  async getLiveTrainingHostRows(eventIds: UUIDType[]) {
    return this.db
      .select({
        eventId: calendarEvents.id,
        userId: users.id,
        fullName: sql<
          string | null
        >`NULLIF(concat_ws(' ', ${users.firstName}, ${users.lastName}), '')`,
        email: users.email,
        role: liveTrainingMembers.role,
      })
      .from(calendarEvents)
      .innerJoin(liveTrainings, eq(liveTrainings.calendarEventId, calendarEvents.id))
      .innerJoin(liveTrainingMembers, eq(liveTrainingMembers.liveTrainingId, liveTrainings.id))
      .innerJoin(users, eq(users.id, liveTrainingMembers.userId))
      .where(inArray(calendarEvents.id, eventIds));
  }

  async getLiveTrainingAuthorRow(eventId: UUIDType) {
    const [row] = await this.db
      .select({
        id: users.id,
        fullName: sql<
          string | null
        >`NULLIF(concat_ws(' ', ${users.firstName}, ${users.lastName}), '')`,
        email: users.email,
      })
      .from(calendarEvents)
      .innerJoin(liveTrainings, eq(liveTrainings.calendarEventId, calendarEvents.id))
      .innerJoin(users, eq(users.id, liveTrainings.authorId))
      .where(eq(calendarEvents.id, eventId));

    return row ?? null;
  }

  async getLiveTrainingMaterialRows(
    eventId: UUIDType,
    relationshipTypes: LiveTrainingResourceRelationshipType[],
    language: SupportedLanguages,
  ) {
    return this.db
      .select({
        resourceId: resources.id,
        title: this.localizationService.getLocalizedSqlField(
          resources.title,
          language,
          calendarEvents,
        ),
        mimeType: resources.contentType,
        size: sql<number | null>`NULL`,
        relationshipType: sql<LiveTrainingResourceRelationshipType>`${resourceEntity.relationshipType}`,
      })
      .from(calendarEvents)
      .innerJoin(liveTrainings, eq(liveTrainings.calendarEventId, calendarEvents.id))
      .innerJoin(resourceEntity, eq(resourceEntity.entityId, liveTrainings.id))
      .innerJoin(resources, eq(resources.id, resourceEntity.resourceId))
      .where(
        and(
          eq(calendarEvents.id, eventId),
          eq(resourceEntity.entityType, ENTITY_TYPES.LIVE_TRAINING),
          inArray(resourceEntity.relationshipType, relationshipTypes),
          eq(resources.archived, false),
        ),
      );
  }

  async getLatestLiveTrainingSessionRow(sourceId: UUIDType) {
    const [row] = await this.db
      .select({
        id: liveTrainingSessions.id,
        status: liveTrainingSessions.status,
        actualStartedAt: liveTrainingSessions.startedAt,
        actualEndedAt: liveTrainingSessions.endedAt,
        peakParticipants: liveTrainingSessions.peakParticipantCount,
        uniqueParticipantCount: liveTrainingSessions.uniqueParticipantCount,
      })
      .from(liveTrainingSessions)
      .where(eq(liveTrainingSessions.liveTrainingId, sourceId))
      .orderBy(desc(liveTrainingSessions.createdAt))
      .limit(1);

    return row ?? null;
  }

  private getLiveTrainingEventsCte(
    conditions: CalendarEventListConditions,
    language: SupportedLanguages,
  ) {
    return this.db.$with("live_training_calendar_events").as(
      this.db
        .select({
          id: sql<UUIDType>`${calendarEvents.id}`.as("id"),
          uid: sql<string>`${calendarEvents.uid}`.as("uid"),
          sourceType: sql<CalendarEventSourceType>`${CALENDAR_EVENT_SOURCE_TYPES.LIVE_TRAINING}`.as(
            "source_type",
          ),
          sourceId: sql<UUIDType>`${liveTrainings.id}`.as("source_id"),
          title: this.localizationService
            .getLocalizedSqlField(calendarEvents.title, language, calendarEvents)
            .as("title"),
          description: this.localizationService
            .getLocalizedSqlField(calendarEvents.description, language, calendarEvents)
            .as("description"),
          startsAt: sql<string>`${calendarEvents.startsAt}`.as("starts_at"),
          endsAt: sql<string>`${calendarEvents.endsAt}`.as("ends_at"),
          allDay: sql<boolean>`${calendarEvents.allDay}`.as("all_day"),
          timezone: sql<string>`${calendarEvents.timezone}`.as("timezone"),
          location: sql<string | null>`${calendarEvents.location}`.as("location"),
          status: sql<CalendarEventStatus>`${calendarEvents.status}`.as("status"),
          payload: sql<LiveTrainingCalendarEventPayload>`
            jsonb_build_object(
              'liveTraining',
              jsonb_build_object(
                'deliveryType', ${liveTrainings.deliveryType},
                'status', ${liveTrainings.status},
                'visibilityScope', ${liveTrainings.visibilityScope},
                'linkedCourses', '[]'::jsonb
              )
            )
          `.as("payload"),
          authorId: sql<UUIDType>`${liveTrainings.authorId}`.as("author_id"),
        })
        .from(calendarEvents)
        .innerJoin(liveTrainings, eq(liveTrainings.calendarEventId, calendarEvents.id))
        .where(and(...conditions)),
    );
  }

  private getCourseDueDateEventsCte(
    conditions: CalendarEventListConditions,
    language: SupportedLanguages,
  ) {
    return this.db.$with("course_due_date_calendar_events_normalized").as(
      this.db
        .select({
          id: sql<UUIDType>`${calendarEvents.id}`.as("id"),
          uid: sql<string>`${calendarEvents.uid}`.as("uid"),
          sourceType:
            sql<CalendarEventSourceType>`${CALENDAR_EVENT_SOURCE_TYPES.COURSE_DUE_DATE}`.as(
              "source_type",
            ),
          sourceId: sql<UUIDType>`${groupCourses.courseId}`.as("source_id"),
          title: this.localizationService
            .getLocalizedSqlField(calendarEvents.title, language, calendarEvents)
            .as("title"),
          description: this.localizationService
            .getLocalizedSqlField(calendarEvents.description, language, calendarEvents)
            .as("description"),
          startsAt: sql<string>`${calendarEvents.startsAt}`.as("starts_at"),
          endsAt: sql<string>`${calendarEvents.endsAt}`.as("ends_at"),
          allDay: sql<boolean>`${calendarEvents.allDay}`.as("all_day"),
          timezone: sql<string>`${calendarEvents.timezone}`.as("timezone"),
          location: sql<string | null>`${calendarEvents.location}`.as("location"),
          status: sql<CalendarEventStatus>`${calendarEvents.status}`.as("status"),
          payload: sql<CourseDueDateCalendarEventPayload>`
            jsonb_build_object(
              'courseDueDate',
              jsonb_build_object(
                'courseId', ${groupCourses.courseId},
                'courseTitle', ${this.localizationService.getLocalizedSqlField(
                  courses.title,
                  language,
                  courses,
                )},
                'groupId', ${groupCourses.groupId},
                'groupName', ${this.localizationService.getLocalizedSqlField(
                  groups.name,
                  language,
                  groups,
                )},
                'dueDate', ${groupCourses.dueDate}
              )
            )
          `.as("payload"),
        })
        .from(groupCourses)
        .innerJoin(calendarEvents, eq(calendarEvents.id, groupCourses.calendarEventId))
        .innerJoin(courses, eq(courses.id, groupCourses.courseId))
        .innerJoin(groups, eq(groups.id, groupCourses.groupId))
        .where(and(...conditions)),
    );
  }
}
