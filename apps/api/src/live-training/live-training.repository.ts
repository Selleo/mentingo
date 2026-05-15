import { Inject, Injectable } from "@nestjs/common";
import {
  CALENDAR_EVENT_STATUSES,
  COURSE_ENROLLMENT,
  ENTITY_TYPES,
  LIVE_TRAINING_LINK_ENTITY_TYPES,
  LIVE_TRAINING_STATUSES,
} from "@repo/shared";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";

import { DatabasePg, type UUIDType } from "src/common";
import { LocalizationService } from "src/localization/localization.service";
import { DB } from "src/storage/db/db.providers";
import {
  calendarEvents,
  courses,
  liveTrainingLinks,
  liveTrainingMembers,
  liveTrainings,
  resourceEntity,
  resources,
  studentCourses,
  users,
} from "src/storage/schema";

import type {
  CalendarEventUpdateInput,
  CreateLiveTrainingRecordInput,
  LiveTrainingLinkInput,
  LiveTrainingListConditions,
  LiveTrainingTrainerInput,
  LiveTrainingUpdateInput,
} from "./live-training.types";
import type { LiveTrainingResourceRelationshipType, SupportedLanguages } from "@repo/shared";

@Injectable()
export class LiveTrainingRepository {
  constructor(
    @Inject(DB) private readonly db: DatabasePg,
    private readonly localizationService: LocalizationService,
  ) {}

  async createLiveTrainingRecord(input: CreateLiveTrainingRecordInput): Promise<UUIDType> {
    return this.db.transaction(async (tx) => {
      const [calendarEvent] = await tx
        .insert(calendarEvents)
        .values(input.calendarEvent)
        .returning({ id: calendarEvents.id });

      const [liveTraining] = await tx
        .insert(liveTrainings)
        .values({
          ...input.liveTraining,
          calendarEventId: calendarEvent.id,
        })
        .returning({ id: liveTrainings.id });

      await tx.insert(liveTrainingMembers).values(
        input.trainers.map((trainer) => ({
          liveTrainingId: liveTraining.id,
          ...trainer,
        })),
      );

      return liveTraining.id;
    });
  }

  async getExistingUserIds(userIds: UUIDType[]) {
    return this.db
      .select({ id: users.id })
      .from(users)
      .where(and(inArray(users.id, userIds), eq(users.archived, false), isNull(users.deletedAt)));
  }

  async getExistingCourseIds(courseIds: UUIDType[]) {
    return this.db.select({ id: courses.id }).from(courses).where(inArray(courses.id, courseIds));
  }

  async getExistingResourceIds(resourceIds: UUIDType[]) {
    return this.db
      .select({ id: resources.id })
      .from(resources)
      .where(and(inArray(resources.id, resourceIds), eq(resources.archived, false)));
  }

  async getLiveTrainingBaseRow(id: UUIDType, language?: SupportedLanguages) {
    const [row] = await this.db
      .select({
        id: liveTrainings.id,
        calendarEventId: liveTrainings.calendarEventId,
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
        baseLanguage: calendarEvents.baseLanguage,
        availableLocales: calendarEvents.availableLocales,
        startsAt: calendarEvents.startsAt,
        endsAt: calendarEvents.endsAt,
        timezone: calendarEvents.timezone,
        location: calendarEvents.location,
        deliveryType: liveTrainings.deliveryType,
        visibilityScope: liveTrainings.visibilityScope,
        status: liveTrainings.status,
        maxParticipants: liveTrainings.maxParticipants,
        authorId: liveTrainings.authorId,
        sequence: calendarEvents.sequence,
        settings: liveTrainings.settings,
        metadata: liveTrainings.metadata,
        authorName: sql<string>`concat_ws(' ', ${users.firstName}, ${users.lastName})`,
        authorEmail: users.email,
      })
      .from(liveTrainings)
      .innerJoin(calendarEvents, eq(calendarEvents.id, liveTrainings.calendarEventId))
      .innerJoin(users, eq(users.id, liveTrainings.authorId))
      .where(
        and(
          eq(liveTrainings.id, id),
          isNull(liveTrainings.deletedAt),
          isNull(calendarEvents.deletedAt),
        ),
      );

    return row ?? null;
  }

  async getLiveTrainingListRows(
    conditions: LiveTrainingListConditions,
    language: SupportedLanguages,
  ) {
    return this.db
      .select({
        id: liveTrainings.id,
        calendarEventId: liveTrainings.calendarEventId,
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
        location: calendarEvents.location,
        deliveryType: liveTrainings.deliveryType,
        visibilityScope: liveTrainings.visibilityScope,
        status: liveTrainings.status,
        maxParticipants: liveTrainings.maxParticipants,
        authorId: liveTrainings.authorId,
      })
      .from(liveTrainings)
      .innerJoin(calendarEvents, eq(calendarEvents.id, liveTrainings.calendarEventId))
      .leftJoin(liveTrainingLinks, eq(liveTrainingLinks.liveTrainingId, liveTrainings.id))
      .where(and(...conditions))
      .orderBy(asc(calendarEvents.startsAt));
  }

  async getLiveTrainingTrainerRows(id: UUIDType) {
    return this.db
      .select({
        id: users.id,
        fullName: sql<string>`concat_ws(' ', ${users.firstName}, ${users.lastName})`,
        email: users.email,
      })
      .from(liveTrainingMembers)
      .innerJoin(users, eq(users.id, liveTrainingMembers.userId))
      .where(eq(liveTrainingMembers.liveTrainingId, id));
  }

  async getLiveTrainingLinkedCourseRows(id: UUIDType, language: SupportedLanguages) {
    return this.db
      .select({
        id: courses.id,
        title: this.localizationService.getLocalizedSqlField(courses.title, language),
      })
      .from(liveTrainingLinks)
      .innerJoin(courses, eq(courses.id, liveTrainingLinks.entityId))
      .where(
        and(
          eq(liveTrainingLinks.liveTrainingId, id),
          eq(liveTrainingLinks.entityType, LIVE_TRAINING_LINK_ENTITY_TYPES.COURSE),
        ),
      );
  }

  async getLiveTrainingMaterialRows(
    id: UUIDType,
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
        description: this.localizationService.getLocalizedSqlField(
          resources.description,
          language,
          calendarEvents,
        ),
        contentType: resources.contentType,
        fileUrl: resources.reference,
        relationshipType: resourceEntity.relationshipType,
      })
      .from(resourceEntity)
      .innerJoin(liveTrainings, eq(liveTrainings.id, resourceEntity.entityId))
      .innerJoin(calendarEvents, eq(calendarEvents.id, liveTrainings.calendarEventId))
      .innerJoin(resources, eq(resources.id, resourceEntity.resourceId))
      .where(
        and(
          eq(resourceEntity.entityId, id),
          eq(resourceEntity.entityType, ENTITY_TYPES.LIVE_TRAINING),
          inArray(resourceEntity.relationshipType, relationshipTypes),
          eq(resources.archived, false),
        ),
      );
  }

  async getEnrolledCourseIds(userId: UUIDType, courseIds: UUIDType[]) {
    return this.db
      .select({ id: studentCourses.courseId })
      .from(studentCourses)
      .where(
        and(
          eq(studentCourses.studentId, userId),
          inArray(studentCourses.courseId, courseIds),
          eq(studentCourses.status, COURSE_ENROLLMENT.ENROLLED),
        ),
      );
  }

  async updateCalendarEvent(calendarEventId: UUIDType, data: CalendarEventUpdateInput) {
    return this.db.update(calendarEvents).set(data).where(eq(calendarEvents.id, calendarEventId));
  }

  async updateLiveTraining(liveTrainingId: UUIDType, data: LiveTrainingUpdateInput) {
    return this.db.update(liveTrainings).set(data).where(eq(liveTrainings.id, liveTrainingId));
  }

  async deleteTrainers(liveTrainingId: UUIDType) {
    return this.db
      .delete(liveTrainingMembers)
      .where(eq(liveTrainingMembers.liveTrainingId, liveTrainingId));
  }

  async insertTrainers(liveTrainingId: UUIDType, trainers: LiveTrainingTrainerInput) {
    return this.db.insert(liveTrainingMembers).values(
      trainers.map((trainer) => ({
        liveTrainingId,
        ...trainer,
      })),
    );
  }

  async deleteLinks(liveTrainingId: UUIDType) {
    return this.db
      .delete(liveTrainingLinks)
      .where(eq(liveTrainingLinks.liveTrainingId, liveTrainingId));
  }

  async insertLinks(liveTrainingId: UUIDType, links: LiveTrainingLinkInput) {
    return this.db.insert(liveTrainingLinks).values(
      links.map((link) => ({
        liveTrainingId,
        ...link,
      })),
    );
  }

  async deleteResourceLinks(
    liveTrainingId: UUIDType,
    relationshipType: LiveTrainingResourceRelationshipType,
  ) {
    return this.db
      .delete(resourceEntity)
      .where(
        and(
          eq(resourceEntity.entityId, liveTrainingId),
          eq(resourceEntity.entityType, ENTITY_TYPES.LIVE_TRAINING),
          eq(resourceEntity.relationshipType, relationshipType),
        ),
      );
  }

  async insertResourceLinks(
    liveTrainingId: UUIDType,
    resourceIds: UUIDType[],
    relationshipType: LiveTrainingResourceRelationshipType,
  ) {
    return this.db.insert(resourceEntity).values(
      resourceIds.map((resourceId) => ({
        resourceId,
        entityId: liveTrainingId,
        entityType: ENTITY_TYPES.LIVE_TRAINING,
        relationshipType,
      })),
    );
  }

  async softDeleteLiveTraining(
    liveTrainingId: UUIDType,
    calendarEventId: UUIDType,
    sequence: number,
  ) {
    const deletedAt = new Date().toISOString();

    await this.db.transaction(async (tx) => {
      await tx
        .update(liveTrainings)
        .set({
          status: LIVE_TRAINING_STATUSES.CANCELLED,
          deletedAt,
        })
        .where(eq(liveTrainings.id, liveTrainingId));

      await tx
        .update(calendarEvents)
        .set({
          status: CALENDAR_EVENT_STATUSES.CANCELLED,
          deletedAt,
          sequence,
        })
        .where(eq(calendarEvents.id, calendarEventId));
    });
  }
}
