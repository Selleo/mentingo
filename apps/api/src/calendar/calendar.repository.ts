import { Inject, Injectable } from "@nestjs/common";
import {
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
  LiveTrainingCalendarEventPayload,
} from "./calendar.types";
import type {
  CalendarEventSourceType,
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
      .select({
        id: liveTrainingEvents.id,
        uid: liveTrainingEvents.uid,
        sourceType: liveTrainingEvents.sourceType,
        sourceId: liveTrainingEvents.sourceId,
        title: liveTrainingEvents.title,
        description: liveTrainingEvents.description,
        startsAt: liveTrainingEvents.startsAt,
        endsAt: liveTrainingEvents.endsAt,
        timezone: liveTrainingEvents.timezone,
        status: liveTrainingEvents.status,
        payload: liveTrainingEvents.payload,
        authorId: liveTrainingEvents.authorId,
      })
      .from(liveTrainingEvents)
      .orderBy(liveTrainingEvents.startsAt);
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

  async getLiveTrainingTrainerRows(eventIds: UUIDType[]) {
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
          id: calendarEvents.id,
          uid: calendarEvents.uid,
          sourceType: sql<CalendarEventSourceType>`${CALENDAR_EVENT_SOURCE_TYPES.LIVE_TRAINING}`,
          sourceId: liveTrainings.id,
          title: this.localizationService.getLocalizedSqlField(
            calendarEvents.title,
            language,
            calendarEvents,
          ),
          description: this.localizationService.getLocalizedSqlField(
            calendarEvents.description,
            language,
            calendarEvents,
          ),
          startsAt: calendarEvents.startsAt,
          endsAt: calendarEvents.endsAt,
          timezone: calendarEvents.timezone,
          status: calendarEvents.status,
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
          `,
          authorId: liveTrainings.authorId,
        })
        .from(calendarEvents)
        .innerJoin(liveTrainings, eq(liveTrainings.calendarEventId, calendarEvents.id))
        .where(and(...conditions)),
    );
  }
}
