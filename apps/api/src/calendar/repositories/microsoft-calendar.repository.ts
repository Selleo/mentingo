import { Inject, Injectable } from "@nestjs/common";
import { LIVE_TRAINING_LINK_ENTITY_TYPES, SUPPORTED_LANGUAGES } from "@repo/shared";
import { and, eq, gt, inArray, isNotNull, isNull, lt, notInArray, or, sql } from "drizzle-orm";
import { aliasedTable } from "drizzle-orm/alias";

import { DatabasePg, type UUIDType } from "src/common";
import { buildJsonbField } from "src/common/helpers/sqlHelpers";
import { LocalizationService } from "src/localization/localization.service";
import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import {
  calendarEvents,
  courses,
  groupCourses,
  groupUsers,
  groups,
  liveTrainingLinks,
  liveTrainingMembers,
  liveTrainings,
  microsoftCalendarConnections,
  microsoftCalendarEvents,
  microsoftCalendarOutboundEvents,
  settings,
  users,
} from "src/storage/schema";

import type {
  MappedMicrosoftCalendarEvent,
  MicrosoftCalendarConnectionCreateInput,
  MicrosoftCalendarConnectionUpdate,
  OutboundCandidate,
} from "../types/microsoft-calendar.types";

@Injectable()
export class MicrosoftCalendarRepository {
  constructor(
    @Inject(DB) private readonly db: DatabasePg,
    @Inject(DB_ADMIN) private readonly dbAdmin: DatabasePg,
    private readonly localizationService: LocalizationService,
  ) {}

  async getConnectionByUserId(userId: UUIDType) {
    const [connection] = await this.db
      .select()
      .from(microsoftCalendarConnections)
      .where(eq(microsoftCalendarConnections.userId, userId))
      .limit(1);
    return connection ?? null;
  }

  async getActiveUserById(userId: UUIDType) {
    const [user] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, userId), eq(users.archived, false), isNull(users.deletedAt)))
      .limit(1);

    return user ?? null;
  }

  async getConnectionById(connectionId: UUIDType) {
    const [connection] = await this.db
      .select()
      .from(microsoftCalendarConnections)
      .where(eq(microsoftCalendarConnections.id, connectionId))
      .limit(1);
    return connection ?? null;
  }

  async getConnectionBySubscriptionId(subscriptionId: string) {
    const [connection] = await this.dbAdmin
      .select()
      .from(microsoftCalendarConnections)
      .where(eq(microsoftCalendarConnections.subscriptionId, subscriptionId))
      .limit(1);
    return connection ?? null;
  }

  async createConnection(input: MicrosoftCalendarConnectionCreateInput) {
    const [connection] = await this.db
      .insert(microsoftCalendarConnections)
      .values({
        userId: input.userId,
        microsoftAccountId: input.microsoftAccountId,
        microsoftEmail: input.microsoftEmail,
        ...input.encryptedRefreshToken,
      })
      .returning();
    return connection;
  }

  async updateConnection(connectionId: UUIDType, update: MicrosoftCalendarConnectionUpdate) {
    const [connection] = await this.db
      .update(microsoftCalendarConnections)
      .set(update)
      .where(eq(microsoftCalendarConnections.id, connectionId))
      .returning();
    return connection ?? null;
  }

  async listConnectionsForReconciliation() {
    return this.db
      .select()
      .from(microsoftCalendarConnections)
      .where(
        or(
          eq(microsoftCalendarConnections.status, "connected"),
          eq(microsoftCalendarConnections.status, "error"),
        ),
      );
  }

  async listOutboundConnections() {
    return this.db
      .select()
      .from(microsoftCalendarConnections)
      .where(eq(microsoftCalendarConnections.outboundSyncEnabled, true));
  }

  async getOutboundMapping(connectionId: UUIDType, calendarEventId: UUIDType, userId: UUIDType) {
    const [mapping] = await this.db
      .select()
      .from(microsoftCalendarOutboundEvents)
      .where(
        and(
          eq(microsoftCalendarOutboundEvents.connectionId, connectionId),
          eq(microsoftCalendarOutboundEvents.calendarEventId, calendarEventId),
          eq(microsoftCalendarOutboundEvents.userId, userId),
        ),
      )
      .limit(1);
    return mapping ?? null;
  }

  async upsertOutboundMapping(input: {
    connectionId: UUIDType;
    calendarEventId: UUIDType;
    userId: UUIDType;
    microsoftEventId: string;
  }) {
    const [mapping] = await this.db
      .insert(microsoftCalendarOutboundEvents)
      .values(input)
      .onConflictDoUpdate({
        target: [
          microsoftCalendarOutboundEvents.tenantId,
          microsoftCalendarOutboundEvents.connectionId,
          microsoftCalendarOutboundEvents.calendarEventId,
          microsoftCalendarOutboundEvents.userId,
        ],
        set: { microsoftEventId: input.microsoftEventId, updatedAt: new Date().toISOString() },
      })
      .returning();
    return mapping;
  }

  async listOutboundMappings(connectionId: UUIDType) {
    return this.db
      .select()
      .from(microsoftCalendarOutboundEvents)
      .where(eq(microsoftCalendarOutboundEvents.connectionId, connectionId));
  }

  async listOutboundCandidates(
    connectionId: UUIDType,
    start: string,
    end: string,
  ): Promise<OutboundCandidate[]> {
    const [connection] = await this.db
      .select({ userId: microsoftCalendarConnections.userId })
      .from(microsoftCalendarConnections)
      .where(eq(microsoftCalendarConnections.id, connectionId))
      .limit(1);
    if (!connection) return [];

    try {
      const liveTrainingAuthor = aliasedTable(users, "live_training_author");
      const recipientLanguage = sql<string>`${settings.settings}->>'language'`;
      const liveTrainingCandidates = this.db
        .selectDistinct({
          calendarEventId: calendarEvents.id,
          uid: calendarEvents.uid,
          title: this.localizationService.getLocalizedSqlField(
            calendarEvents.title,
            recipientLanguage,
            calendarEvents,
          ),
          description: this.localizationService.getLocalizedSqlField(
            calendarEvents.description,
            recipientLanguage,
            calendarEvents,
          ),
          startsAt: calendarEvents.startsAt,
          endsAt: calendarEvents.endsAt,
          allDay: calendarEvents.allDay,
          timezone: calendarEvents.timezone,
          location: calendarEvents.location,
          sourceType: sql<"live_training" | "course_due_date">`'live_training'`,
          sourceId: liveTrainings.id,
          recipientId: users.id,
          groupName: sql<string | null>`NULL::text`,
          courseTitle: sql<string | null>`NULL::text`,
        })
        .from(calendarEvents)
        .innerJoin(liveTrainings, eq(liveTrainings.calendarEventId, calendarEvents.id))
        .innerJoin(liveTrainingAuthor, eq(liveTrainingAuthor.id, liveTrainings.authorId))
        .leftJoin(liveTrainingMembers, eq(liveTrainingMembers.liveTrainingId, liveTrainings.id))
        .leftJoin(liveTrainingLinks, eq(liveTrainingLinks.liveTrainingId, liveTrainings.id))
        .leftJoin(
          groupCourses,
          and(
            eq(groupCourses.courseId, liveTrainingLinks.entityId),
            eq(liveTrainingLinks.entityType, LIVE_TRAINING_LINK_ENTITY_TYPES.COURSE),
          ),
        )
        .leftJoin(groupUsers, eq(groupUsers.groupId, groupCourses.groupId))
        .innerJoin(
          users,
          or(
            eq(users.id, liveTrainingAuthor.id),
            eq(users.id, liveTrainingMembers.userId),
            eq(users.id, groupUsers.userId),
          ),
        )
        .leftJoin(settings, eq(settings.userId, users.id))
        .where(
          and(
            lt(calendarEvents.startsAt, end),
            gt(calendarEvents.endsAt, start),
            isNull(calendarEvents.deletedAt),
            isNull(liveTrainings.deletedAt),
            eq(users.id, connection.userId),
          ),
        );

      const courseDueDateCandidates = this.db
        .selectDistinct({
          calendarEventId: calendarEvents.id,
          uid: calendarEvents.uid,
          title: this.localizationService.getLocalizedSqlField(
            calendarEvents.title,
            recipientLanguage,
            calendarEvents,
          ),
          description: this.localizationService.getLocalizedSqlField(
            calendarEvents.description,
            recipientLanguage,
            calendarEvents,
          ),
          startsAt: calendarEvents.startsAt,
          endsAt: calendarEvents.endsAt,
          allDay: calendarEvents.allDay,
          timezone: calendarEvents.timezone,
          location: calendarEvents.location,
          sourceType: sql<"live_training" | "course_due_date">`'course_due_date'`,
          sourceId: groupCourses.courseId,
          recipientId: users.id,
          groupName: this.localizationService.getLocalizedSqlField(
            groups.name,
            recipientLanguage,
            groups,
          ),
          courseTitle: this.localizationService.getLocalizedSqlField(
            courses.title,
            recipientLanguage,
            courses,
          ),
        })
        .from(calendarEvents)
        .innerJoin(groupCourses, eq(groupCourses.calendarEventId, calendarEvents.id))
        .innerJoin(groups, eq(groups.id, groupCourses.groupId))
        .innerJoin(courses, eq(courses.id, groupCourses.courseId))
        .innerJoin(groupUsers, eq(groupUsers.groupId, groupCourses.groupId))
        .innerJoin(users, or(eq(users.id, courses.authorId), eq(users.id, groupUsers.userId)))
        .leftJoin(settings, eq(settings.userId, users.id))
        .where(
          and(
            lt(calendarEvents.startsAt, end),
            gt(calendarEvents.endsAt, start),
            isNull(calendarEvents.deletedAt),
            eq(groupCourses.isMandatory, true),
            isNotNull(groupCourses.dueDate),
            eq(users.id, connection.userId),
          ),
        );

      const [liveTrainingRows, courseDueDateRows] = await Promise.all([
        liveTrainingCandidates,
        courseDueDateCandidates,
      ]);

      return [...liveTrainingRows, ...courseDueDateRows];
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to load Microsoft outbound candidates: ${message}`);
    }
  }

  async deleteOutboundMapping(id: UUIDType) {
    await this.db
      .delete(microsoftCalendarOutboundEvents)
      .where(eq(microsoftCalendarOutboundEvents.id, id));
  }

  async listConnectionsNeedingSubscriptionRenewal(renewBefore: string) {
    return this.db
      .select()
      .from(microsoftCalendarConnections)
      .where(
        and(
          or(
            eq(microsoftCalendarConnections.status, "connected"),
            eq(microsoftCalendarConnections.status, "error"),
          ),
          or(
            sql`${microsoftCalendarConnections.subscriptionExpiresAt} IS NULL`,
            lt(microsoftCalendarConnections.subscriptionExpiresAt, renewBefore),
          ),
        ),
      );
  }

  async upsertEvent(connectionId: UUIDType, userId: UUIDType, event: MappedMicrosoftCalendarEvent) {
    const uid = `microsoft-outlook:${userId}:${event.microsoftEventId}`;

    return this.db.transaction(async (trx) => {
      const [calendarEvent] = await trx
        .insert(calendarEvents)
        .values({
          uid,
          baseLanguage: SUPPORTED_LANGUAGES.EN,
          availableLocales: [SUPPORTED_LANGUAGES.EN],
          title: buildJsonbField(SUPPORTED_LANGUAGES.EN, event.title),
          description: null,
          startsAt: event.startsAt,
          endsAt: event.endsAt,
          allDay: event.allDay,
          timezone: event.timezone,
          location: event.location,
          status: event.isCancelled ? "cancelled" : "scheduled",
        })
        .onConflictDoUpdate({
          target: [calendarEvents.tenantId, calendarEvents.uid],
          set: {
            title: sql.raw(`excluded.${calendarEvents.title.name}`),
            description: null,
            startsAt: event.startsAt,
            endsAt: event.endsAt,
            allDay: event.allDay,
            timezone: event.timezone,
            location: event.location,
            status: event.isCancelled ? "cancelled" : "scheduled",
            deletedAt: null,
            sequence: sql`${calendarEvents.sequence} + 1`,
          },
        })
        .returning({ id: calendarEvents.id });

      const [externalEvent] = await trx
        .insert(microsoftCalendarEvents)
        .values({
          connectionId,
          calendarEventId: calendarEvent.id,
          userId,
          microsoftEventId: event.microsoftEventId,
          webLink: event.webLink,
          sensitivity: event.sensitivity,
          availability: event.availability,
          isCancelled: event.isCancelled,
        })
        .onConflictDoUpdate({
          target: [
            microsoftCalendarEvents.tenantId,
            microsoftCalendarEvents.connectionId,
            microsoftCalendarEvents.microsoftEventId,
          ],
          set: {
            calendarEventId: calendarEvent.id,
            webLink: event.webLink,
            sensitivity: event.sensitivity,
            availability: event.availability,
            isCancelled: event.isCancelled,
          },
        })
        .returning();

      return externalEvent;
    });
  }

  async removeEvents(connectionId: UUIDType, microsoftEventIds: string[]) {
    if (!microsoftEventIds.length) return;

    const rows = await this.db
      .select({ calendarEventId: microsoftCalendarEvents.calendarEventId })
      .from(microsoftCalendarEvents)
      .where(
        and(
          eq(microsoftCalendarEvents.connectionId, connectionId),
          inArray(microsoftCalendarEvents.microsoftEventId, microsoftEventIds),
        ),
      );

    if (!rows.length) return;

    await this.db.delete(calendarEvents).where(
      inArray(
        calendarEvents.id,
        rows.map(({ calendarEventId }) => calendarEventId),
      ),
    );
  }

  async removeEventsMissingFromFullSync(connectionId: UUIDType, seenEventIds: string[]) {
    const condition = seenEventIds.length
      ? and(
          eq(microsoftCalendarEvents.connectionId, connectionId),
          notInArray(microsoftCalendarEvents.microsoftEventId, seenEventIds),
        )
      : eq(microsoftCalendarEvents.connectionId, connectionId);

    const rows = await this.db
      .select({ calendarEventId: microsoftCalendarEvents.calendarEventId })
      .from(microsoftCalendarEvents)
      .where(condition);

    if (rows.length) {
      await this.db.delete(calendarEvents).where(
        inArray(
          calendarEvents.id,
          rows.map(({ calendarEventId }) => calendarEventId),
        ),
      );
    }
  }

  async deleteConnectionAndEvents(connectionId: UUIDType) {
    const rows = await this.db
      .select({ calendarEventId: microsoftCalendarEvents.calendarEventId })
      .from(microsoftCalendarEvents)
      .where(eq(microsoftCalendarEvents.connectionId, connectionId));

    await this.db.transaction(async (trx) => {
      if (rows.length) {
        await trx.delete(calendarEvents).where(
          inArray(
            calendarEvents.id,
            rows.map(({ calendarEventId }) => calendarEventId),
          ),
        );
      }

      await trx
        .delete(microsoftCalendarConnections)
        .where(eq(microsoftCalendarConnections.id, connectionId));
    });
  }
}
