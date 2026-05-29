import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  CALENDAR_EVENT_SOURCE_ROLES,
  COURSE_ENROLLMENT,
  LIVE_TRAINING_LINK_ENTITY_TYPES,
  LIVE_TRAINING_RESOURCE_RELATIONSHIP_TYPES,
  LIVE_TRAINING_STATUSES,
  LIVE_TRAINING_VISIBILITY_SCOPES,
  PERMISSIONS,
  type CalendarEventSourceRole,
  type LiveTrainingResourceRelationshipType,
  type SupportedLanguages,
} from "@repo/shared";
import { and, eq, gt, isNull, lt, or, sql, type SQL } from "drizzle-orm";

import { hasAnyPermission } from "src/common/permissions/permission.utils";
import { SettingsService } from "src/settings/settings.service";
import {
  calendarEvents,
  liveTrainingLinks,
  liveTrainingMembers,
  liveTrainings,
  studentCourses,
} from "src/storage/schema";

import { CalendarRepository } from "./calendar.repository";

import type {
  CalendarEventLinkedCourse,
  CalendarEventMaterialRow,
  CalendarEventNormalizedRow,
  CalendarEventHostRow,
} from "./calendar.types";
import type { CalendarEventDetails } from "./schemas/calendar-event-details.schema";
import type {
  CalendarEventList,
  CalendarEventListItem,
} from "./schemas/calendar-event-list.schema";
import type { GetCalendarEventsQuery } from "./schemas/get-calendar-events-query.schema";
import type { UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";

@Injectable()
export class CalendarService {
  constructor(
    private readonly calendarRepository: CalendarRepository,
    private readonly settingsService: SettingsService,
  ) {}

  async getEvents(
    query: GetCalendarEventsQuery,
    currentUser: CurrentUserType,
  ): Promise<CalendarEventList> {
    this.assertValidDateRange(query.start, query.end);

    const sourceEvents = await this.getCalendarSourceEvents(query, currentUser);
    const events = sourceEvents.flat().sort(this.sortEventsByStartDate);

    return { events };
  }

  async getEventDetails(
    eventId: UUIDType,
    language: SupportedLanguages,
    currentUser: CurrentUserType,
  ): Promise<CalendarEventDetails> {
    const sourceDetails = await this.getCalendarSourceEventDetails(eventId, language, currentUser);
    const eventDetails = sourceDetails.find((details) => details !== null);

    if (!eventDetails) {
      throw new NotFoundException("calendar.errors.eventNotFound");
    }

    return eventDetails;
  }

  private async getCalendarSourceEvents(
    query: GetCalendarEventsQuery,
    currentUser: CurrentUserType,
  ) {
    return Promise.all([this.getLiveTrainingEvents(query, currentUser)]);
  }

  private async getCalendarSourceEventDetails(
    eventId: UUIDType,
    language: SupportedLanguages,
    currentUser: CurrentUserType,
  ) {
    return Promise.all([this.getLiveTrainingEventDetails(eventId, language, currentUser)]);
  }

  private async getLiveTrainingEvents(
    query: GetCalendarEventsQuery,
    currentUser: CurrentUserType,
  ): Promise<CalendarEventListItem[]> {
    if (!(await this.isLiveTrainingSourceEnabled(currentUser))) {
      return [];
    }

    const rows = await this.calendarRepository.getLiveTrainingCalendarEventRows(
      this.getLiveTrainingListConditions(query, currentUser),
      query.language,
    );
    const eventIds = rows.map((row) => row.id);
    const [hostsByEventId, linkedCoursesByEventId] = await Promise.all([
      this.getHostsByEventId(eventIds),
      this.getLinkedCoursesByEventId(eventIds, query.language),
    ]);

    return rows.map((row) =>
      this.mapLiveTrainingListItem(
        row,
        hostsByEventId.get(row.id),
        linkedCoursesByEventId.get(row.id),
        currentUser,
      ),
    );
  }

  private async getLiveTrainingEventDetails(
    eventId: UUIDType,
    language: SupportedLanguages,
    currentUser: CurrentUserType,
  ): Promise<CalendarEventDetails | null> {
    if (!(await this.isLiveTrainingSourceEnabled(currentUser))) {
      return null;
    }

    const rows = await this.calendarRepository.getLiveTrainingCalendarEventRows(
      this.getLiveTrainingDetailConditions(eventId, currentUser),
      language,
    );
    const row = rows[0];

    if (!row) {
      return null;
    }

    const [hosts, linkedCoursesByEventId, author, materials, latestSession] = await Promise.all([
      this.calendarRepository.getLiveTrainingHostRows([row.id]),
      this.getLinkedCoursesByEventId([row.id], language),
      this.calendarRepository.getLiveTrainingAuthorRow(row.id),
      this.calendarRepository.getLiveTrainingMaterialRows(
        row.id,
        [
          LIVE_TRAINING_RESOURCE_RELATIONSHIP_TYPES.BEFORE,
          LIVE_TRAINING_RESOURCE_RELATIONSHIP_TYPES.AFTER,
        ],
        language,
      ),
      this.calendarRepository.getLatestLiveTrainingSessionRow(row.sourceId),
    ]);
    const linkedCourses = linkedCoursesByEventId.get(row.id);

    const listItem = this.mapLiveTrainingListItem(row, hosts, linkedCourses, currentUser);
    const isPrivilegedViewer = this.isPrivilegedViewer(row, hosts, currentUser);

    return {
      ...listItem,
      payload: {
        liveTraining: {
          ...listItem.payload.liveTraining,
          author: author ?? {
            id: row.authorId,
            fullName: null,
            email: "",
          },
          hosts: hosts.map((host) => ({
            userId: host.userId,
            fullName: host.fullName,
            email: host.email,
            role: host.role,
          })),
          materials: this.getVisibleMaterials(
            materials,
            row.payload.liveTraining.status,
            isPrivilegedViewer,
          ),
          latestSession,
        },
      },
    };
  }

  private mapLiveTrainingListItem(
    row: CalendarEventNormalizedRow,
    hosts: CalendarEventHostRow[] = [],
    linkedCourses: CalendarEventLinkedCourse[] = [],
    currentUser: CurrentUserType,
  ): CalendarEventListItem {
    const sourceRole = this.getSourceRole(row, hosts, currentUser);

    return {
      id: row.id,
      uid: row.uid,
      sourceType: row.sourceType,
      sourceId: row.sourceId,
      title: row.title,
      description: row.description || null,
      startsAt: row.startsAt,
      endsAt: row.endsAt,
      allDay: row.allDay,
      timezone: row.timezone,
      location: row.location,
      status: row.status,
      payload: {
        liveTraining: {
          ...row.payload.liveTraining,
          linkedCourses,
          sourceRole,
        },
      },
    };
  }

  private async getHostsByEventId(eventIds: UUIDType[]) {
    if (!eventIds.length) {
      return new Map<UUIDType, CalendarEventHostRow[]>();
    }

    const rows = await this.calendarRepository.getLiveTrainingHostRows(eventIds);
    const hostsByEventId = new Map<UUIDType, CalendarEventHostRow[]>();

    for (const row of rows) {
      const hosts = hostsByEventId.get(row.eventId) ?? [];
      hosts.push(row);
      hostsByEventId.set(row.eventId, hosts);
    }

    return hostsByEventId;
  }

  private async getLinkedCoursesByEventId(eventIds: UUIDType[], language: SupportedLanguages) {
    if (!eventIds.length) {
      return new Map<UUIDType, CalendarEventLinkedCourse[]>();
    }

    const rows = await this.calendarRepository.getLiveTrainingLinkedCourseRows(eventIds, language);
    const linkedCoursesByEventId = new Map<UUIDType, CalendarEventLinkedCourse[]>();

    for (const row of rows) {
      const linkedCourses = linkedCoursesByEventId.get(row.eventId) ?? [];
      linkedCourses.push({
        courseId: row.courseId,
        courseTitle: row.courseTitle,
      });
      linkedCoursesByEventId.set(row.eventId, linkedCourses);
    }

    return linkedCoursesByEventId;
  }

  private getLiveTrainingListConditions(
    query: GetCalendarEventsQuery,
    currentUser: CurrentUserType,
  ) {
    const conditions = this.getLiveTrainingBaseConditions(currentUser);

    const dateRangeCondition = and(
      lt(calendarEvents.startsAt, query.end),
      gt(calendarEvents.endsAt, query.start),
    );

    if (dateRangeCondition) {
      conditions.push(dateRangeCondition);
    }

    return conditions;
  }

  private getLiveTrainingDetailConditions(eventId: UUIDType, currentUser: CurrentUserType) {
    const conditions = this.getLiveTrainingBaseConditions(currentUser);
    conditions.push(eq(calendarEvents.id, eventId));

    return conditions;
  }

  private getLiveTrainingBaseConditions(currentUser: CurrentUserType) {
    const conditions: SQL[] = [isNull(calendarEvents.deletedAt), isNull(liveTrainings.deletedAt)];
    conditions.push(this.getLiveTrainingVisibilityCondition(currentUser));

    return conditions;
  }

  private getLiveTrainingVisibilityCondition(currentUser: CurrentUserType): SQL {
    if (this.canManageAnyLiveTraining(currentUser)) {
      return sql`TRUE`;
    }

    const authorCondition = eq(liveTrainings.authorId, currentUser.userId);
    const hostCondition = sql`
      EXISTS (
        SELECT 1
        FROM ${liveTrainingMembers}
        WHERE ${liveTrainingMembers.liveTrainingId} = ${liveTrainings.id}
          AND ${liveTrainingMembers.userId} = ${currentUser.userId}
      )
    `;
    const allUsersCondition = eq(
      liveTrainings.visibilityScope,
      LIVE_TRAINING_VISIBILITY_SCOPES.ALL,
    );
    const enrolledCourseCondition = sql`
      EXISTS (
        SELECT 1
        FROM ${liveTrainingLinks}
        INNER JOIN ${studentCourses} ON ${studentCourses.courseId} = ${liveTrainingLinks.entityId}
        WHERE ${liveTrainingLinks.liveTrainingId} = ${liveTrainings.id}
          AND ${liveTrainingLinks.entityType} = ${LIVE_TRAINING_LINK_ENTITY_TYPES.COURSE}
          AND ${studentCourses.studentId} = ${currentUser.userId}
          AND ${studentCourses.status} = ${COURSE_ENROLLMENT.ENROLLED}
      )
    `;
    const visibilityCondition = or(
      authorCondition,
      hostCondition,
      allUsersCondition,
      enrolledCourseCondition,
    );

    if (visibilityCondition) {
      return visibilityCondition;
    }

    return sql`FALSE`;
  }

  private sortEventsByStartDate(
    firstEvent: CalendarEventListItem,
    secondEvent: CalendarEventListItem,
  ) {
    return Date.parse(firstEvent.startsAt) - Date.parse(secondEvent.startsAt);
  }

  private getSourceRole(
    row: CalendarEventNormalizedRow,
    hosts: CalendarEventHostRow[],
    currentUser: CurrentUserType,
  ): CalendarEventSourceRole {
    if (this.canManageAnyLiveTraining(currentUser)) {
      return CALENDAR_EVENT_SOURCE_ROLES.ADMIN;
    }

    if (row.authorId === currentUser.userId) {
      return CALENDAR_EVENT_SOURCE_ROLES.AUTHOR;
    }

    if (hosts.some((host) => host.userId === currentUser.userId)) {
      return CALENDAR_EVENT_SOURCE_ROLES.TRAINER;
    }

    return CALENDAR_EVENT_SOURCE_ROLES.OBSERVER;
  }

  private getVisibleMaterials(
    materials: CalendarEventMaterialRow[],
    status: string,
    isPrivilegedViewer: boolean,
  ) {
    const before = this.mapMaterialsByRelationshipType(
      materials,
      LIVE_TRAINING_RESOURCE_RELATIONSHIP_TYPES.BEFORE,
    );
    const after = this.mapMaterialsByRelationshipType(
      materials,
      LIVE_TRAINING_RESOURCE_RELATIONSHIP_TYPES.AFTER,
    );

    if (isPrivilegedViewer) return { before, after };
    if (status === LIVE_TRAINING_STATUSES.ENDED) return { before: [], after };

    return { before, after: [] };
  }

  private mapMaterialsByRelationshipType(
    materials: CalendarEventMaterialRow[],
    relationshipType: LiveTrainingResourceRelationshipType,
  ) {
    return materials
      .filter((material) => material.relationshipType === relationshipType)
      .map((material) => ({
        ...material,
        relationshipType,
      }));
  }

  private isPrivilegedViewer(
    row: CalendarEventNormalizedRow,
    hosts: CalendarEventHostRow[],
    currentUser: CurrentUserType,
  ) {
    if (this.canManageAnyLiveTraining(currentUser)) return true;
    if (row.authorId === currentUser.userId) return true;

    return hosts.some((host) => host.userId === currentUser.userId);
  }

  private canManageAnyLiveTraining(currentUser: CurrentUserType) {
    return hasAnyPermission(currentUser.permissions, [
      PERMISSIONS.LIVE_TRAINING_UPDATE,
      PERMISSIONS.LIVE_TRAINING_DELETE,
    ]);
  }

  private async isLiveTrainingSourceEnabled(currentUser: CurrentUserType) {
    const globalSettings = await this.settingsService.getGlobalSettingsByTenantId(
      currentUser.tenantId,
    );

    return globalSettings.liveTrainingEnabled;
  }

  private assertValidDateRange(start: string, end: string) {
    const startsAtTime = Date.parse(start);
    const endsAtTime = Date.parse(end);

    if (Number.isNaN(startsAtTime) || Number.isNaN(endsAtTime) || endsAtTime <= startsAtTime) {
      throw new BadRequestException("calendar.errors.invalidDateRange");
    }
  }
}
