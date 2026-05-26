import { Inject, Injectable } from "@nestjs/common";
import {
  CALENDAR_EVENT_STATUSES,
  COURSE_ENROLLMENT,
  ENTITY_TYPES,
  LIVE_TRAINING_LINK_ENTITY_TYPES,
  LIVE_TRAINING_SESSION_STATUSES,
  LIVE_TRAINING_STATUSES,
  SYSTEM_ROLE_SLUGS,
} from "@repo/shared";
import { and, asc, count, desc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { DatabasePg, type UUIDType } from "src/common";
import { LocalizationService } from "src/localization/localization.service";
import { DB } from "src/storage/db/db.providers";
import {
  calendarEvents,
  courses,
  liveLessons,
  liveTrainingAttendance,
  liveTrainingLinks,
  liveTrainingMembers,
  liveTrainingSessions,
  liveTrainings,
  permissionRoles,
  permissionUserRoles,
  resourceEntity,
  resources,
  studentCourses,
  users,
} from "src/storage/schema";

import type {
  CalendarEventUpdateInput,
  CreateLiveTrainingRecordInput,
  LiveTrainingHostCandidateQuery,
  LiveTrainingHostInput,
  LiveTrainingLinkInput,
  LiveTrainingListConditions,
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
    return this.db.transaction((tx) => this.createLiveTrainingRecordInTransaction(input, tx));
  }

  async createLiveTrainingRecordInTransaction(
    input: CreateLiveTrainingRecordInput,
    dbInstance: DatabasePg,
  ): Promise<UUIDType> {
    const [calendarEvent] = await dbInstance
      .insert(calendarEvents)
      .values(input.calendarEvent)
      .returning({ id: calendarEvents.id });

    const [liveTraining] = await dbInstance
      .insert(liveTrainings)
      .values({
        ...input.liveTraining,
        calendarEventId: calendarEvent.id,
      })
      .returning({ id: liveTrainings.id });

    await dbInstance.insert(liveTrainingMembers).values(
      input.hosts.map((host) => ({
        liveTrainingId: liveTraining.id,
        ...host,
      })),
    );

    return liveTraining.id;
  }

  async getExistingUserIds(userIds: UUIDType[]) {
    return this.db
      .select({ id: users.id })
      .from(users)
      .where(and(inArray(users.id, userIds), eq(users.archived, false), isNull(users.deletedAt)));
  }

  async getUserIdsWithTrainerRole(userIds: UUIDType[]) {
    if (!userIds.length) return [];

    return this.db
      .select({ id: users.id })
      .from(users)
      .innerJoin(
        permissionUserRoles,
        and(
          eq(permissionUserRoles.userId, users.id),
          eq(permissionUserRoles.tenantId, users.tenantId),
        ),
      )
      .innerJoin(
        permissionRoles,
        and(
          eq(permissionRoles.id, permissionUserRoles.roleId),
          eq(permissionRoles.tenantId, permissionUserRoles.tenantId),
        ),
      )
      .where(
        and(
          inArray(users.id, userIds),
          eq(users.archived, false),
          isNull(users.deletedAt),
          eq(permissionRoles.slug, SYSTEM_ROLE_SLUGS.TRAINER),
        ),
      );
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

  async getHostCandidates({ keyword, page, perPage }: LiveTrainingHostCandidateQuery) {
    const conditions = [
      eq(users.archived, false),
      isNull(users.deletedAt),
      eq(permissionRoles.slug, SYSTEM_ROLE_SLUGS.TRAINER),
    ];

    if (keyword) {
      const keywordCondition = or(
        ilike(users.firstName, `%${keyword}%`),
        ilike(users.lastName, `%${keyword}%`),
        ilike(users.email, `%${keyword}%`),
      );

      if (keywordCondition) conditions.push(keywordCondition);
    }

    const data = await this.db
      .select({
        id: users.id,
        fullName: sql<
          string | null
        >`nullif(concat_ws(' ', ${users.firstName}, ${users.lastName}), '')`,
        email: users.email,
        avatarReference: users.avatarReference,
      })
      .from(users)
      .innerJoin(
        permissionUserRoles,
        and(
          eq(permissionUserRoles.userId, users.id),
          eq(permissionUserRoles.tenantId, users.tenantId),
        ),
      )
      .innerJoin(
        permissionRoles,
        and(
          eq(permissionRoles.id, permissionUserRoles.roleId),
          eq(permissionRoles.tenantId, permissionUserRoles.tenantId),
        ),
      )
      .where(and(...conditions))
      .groupBy(users.id)
      .orderBy(asc(users.firstName), asc(users.lastName), asc(users.email))
      .limit(perPage)
      .offset((page - 1) * perPage);

    const [{ totalItems }] = await this.db
      .select({ totalItems: count() })
      .from(users)
      .innerJoin(
        permissionUserRoles,
        and(
          eq(permissionUserRoles.userId, users.id),
          eq(permissionUserRoles.tenantId, users.tenantId),
        ),
      )
      .innerJoin(
        permissionRoles,
        and(
          eq(permissionRoles.id, permissionUserRoles.roleId),
          eq(permissionRoles.tenantId, permissionUserRoles.tenantId),
        ),
      )
      .where(and(...conditions));

    return {
      data,
      pagination: { totalItems, page, perPage },
    };
  }

  async getLiveTrainingBaseRow(
    id: UUIDType,
    language?: SupportedLanguages,
    dbInstance: DatabasePg = this.db,
  ) {
    const [row] = await dbInstance
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
        allDay: calendarEvents.allDay,
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
        authorName: sql<
          string | null
        >`nullif(concat_ws(' ', ${users.firstName}, ${users.lastName}), '')`,
        authorAvatarReference: users.avatarReference,
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

  async getCurrentSessionRow(liveTrainingId: UUIDType) {
    const startedBy = alias(users, "started_by_user");
    const endedBy = alias(users, "ended_by_user");

    const [row] = await this.db
      .select({
        id: liveTrainingSessions.id,
        status: liveTrainingSessions.status,
        startedAt: liveTrainingSessions.startedAt,
        endedAt: liveTrainingSessions.endedAt,
        startedByUserId: liveTrainingSessions.startedByUserId,
        endedByUserId: liveTrainingSessions.endedByUserId,
        startedByFullName: sql<
          string | null
        >`nullif(concat_ws(' ', ${startedBy.firstName}, ${startedBy.lastName}), '')`,
        startedByAvatarReference: startedBy.avatarReference,
        endedByFullName: sql<
          string | null
        >`nullif(concat_ws(' ', ${endedBy.firstName}, ${endedBy.lastName}), '')`,
        endedByAvatarReference: endedBy.avatarReference,
        peakParticipantCount: liveTrainingSessions.peakParticipantCount,
        uniqueParticipantCount: liveTrainingSessions.uniqueParticipantCount,
        activeParticipantCount: sql<number>`count(${liveTrainingAttendance.id})::int`,
        endReason: liveTrainingSessions.endReason,
      })
      .from(liveTrainingSessions)
      .leftJoin(startedBy, eq(startedBy.id, liveTrainingSessions.startedByUserId))
      .leftJoin(endedBy, eq(endedBy.id, liveTrainingSessions.endedByUserId))
      .leftJoin(
        liveTrainingAttendance,
        and(
          eq(liveTrainingAttendance.liveTrainingSessionId, liveTrainingSessions.id),
          isNull(liveTrainingAttendance.leftAt),
        ),
      )
      .where(
        and(
          eq(liveTrainingSessions.liveTrainingId, liveTrainingId),
          inArray(liveTrainingSessions.status, [
            LIVE_TRAINING_SESSION_STATUSES.WAITING,
            LIVE_TRAINING_SESSION_STATUSES.ACTIVE,
          ]),
        ),
      )
      .groupBy(liveTrainingSessions.id, startedBy.id, endedBy.id)
      .orderBy(desc(liveTrainingSessions.createdAt));

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
        allDay: calendarEvents.allDay,
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

  async getLiveTrainingHostRows(id: UUIDType, dbInstance: DatabasePg = this.db) {
    return dbInstance
      .select({
        id: users.id,
        fullName: sql<
          string | null
        >`nullif(concat_ws(' ', ${users.firstName}, ${users.lastName}), '')`,
        avatarReference: users.avatarReference,
      })
      .from(liveTrainingMembers)
      .innerJoin(users, eq(users.id, liveTrainingMembers.userId))
      .where(eq(liveTrainingMembers.liveTrainingId, id));
  }

  async getLiveTrainingLinkedCourseRows(
    id: UUIDType,
    language: SupportedLanguages,
    dbInstance: DatabasePg = this.db,
  ) {
    return dbInstance
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
        size: sql<number | null>`NULLIF(${resources.metadata}->>'size', '')::int`,
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

  async getLiveTrainingMaterialRowByResourceId(
    liveTrainingId: UUIDType,
    resourceId: UUIDType,
    language: SupportedLanguages,
  ) {
    const [row] = await this.db
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
        reference: resources.reference,
        size: sql<number | null>`NULLIF(${resources.metadata}->>'size', '')::int`,
        relationshipType: resourceEntity.relationshipType,
      })
      .from(resourceEntity)
      .innerJoin(liveTrainings, eq(liveTrainings.id, resourceEntity.entityId))
      .innerJoin(calendarEvents, eq(calendarEvents.id, liveTrainings.calendarEventId))
      .innerJoin(resources, eq(resources.id, resourceEntity.resourceId))
      .where(
        and(
          eq(resourceEntity.entityId, liveTrainingId),
          eq(resourceEntity.resourceId, resourceId),
          eq(resourceEntity.entityType, ENTITY_TYPES.LIVE_TRAINING),
          eq(resources.archived, false),
        ),
      );

    return row;
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

  async deleteHosts(liveTrainingId: UUIDType) {
    return this.db
      .delete(liveTrainingMembers)
      .where(eq(liveTrainingMembers.liveTrainingId, liveTrainingId));
  }

  async insertHosts(liveTrainingId: UUIDType, hosts: LiveTrainingHostInput) {
    return this.db.insert(liveTrainingMembers).values(
      hosts.map((host) => ({
        liveTrainingId,
        ...host,
      })),
    );
  }

  async deleteLinks(liveTrainingId: UUIDType) {
    return this.db
      .delete(liveTrainingLinks)
      .where(eq(liveTrainingLinks.liveTrainingId, liveTrainingId));
  }

  async insertLinks(
    liveTrainingId: UUIDType,
    links: LiveTrainingLinkInput,
    dbInstance: DatabasePg = this.db,
  ) {
    return dbInstance
      .insert(liveTrainingLinks)
      .values(
        links.map((link) => ({
          liveTrainingId,
          ...link,
        })),
      )
      .returning({
        id: liveTrainingLinks.id,
        entityId: liveTrainingLinks.entityId,
        entityType: liveTrainingLinks.entityType,
      });
  }

  async getCourseLink(
    liveTrainingId: UUIDType,
    courseId: UUIDType,
    dbInstance: DatabasePg = this.db,
  ) {
    const [link] = await dbInstance
      .select({
        id: liveTrainingLinks.id,
        entityId: liveTrainingLinks.entityId,
        entityType: liveTrainingLinks.entityType,
      })
      .from(liveTrainingLinks)
      .where(
        and(
          eq(liveTrainingLinks.liveTrainingId, liveTrainingId),
          eq(liveTrainingLinks.entityType, LIVE_TRAINING_LINK_ENTITY_TYPES.COURSE),
          eq(liveTrainingLinks.entityId, courseId),
        ),
      );

    return link ?? null;
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

  async deleteResourceLink(liveTrainingId: UUIDType, resourceId: UUIDType) {
    return this.db
      .delete(resourceEntity)
      .where(
        and(
          eq(resourceEntity.entityId, liveTrainingId),
          eq(resourceEntity.resourceId, resourceId),
          eq(resourceEntity.entityType, ENTITY_TYPES.LIVE_TRAINING),
        ),
      );
  }

  async insertResourceLinks(
    liveTrainingId: UUIDType,
    resourceIds: UUIDType[],
    relationshipType: LiveTrainingResourceRelationshipType,
    dbInstance: DatabasePg = this.db,
  ) {
    return dbInstance.insert(resourceEntity).values(
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

  async getLinkedLessonCount(liveTrainingId: UUIDType) {
    const [row] = await this.db
      .select({
        count: sql<number>`count(DISTINCT ${liveLessons.lessonId})::int`,
      })
      .from(liveLessons)
      .where(eq(liveLessons.liveTrainingId, liveTrainingId));

    return row?.count ?? 0;
  }
}
