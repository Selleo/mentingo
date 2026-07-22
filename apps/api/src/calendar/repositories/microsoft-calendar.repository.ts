import { Inject, Injectable } from "@nestjs/common";
import { SUPPORTED_LANGUAGES } from "@repo/shared";
import { and, eq, inArray, isNull, lt, notInArray, or, sql } from "drizzle-orm";

import { DatabasePg, type UUIDType } from "src/common";
import { buildJsonbField } from "src/common/helpers/sqlHelpers";
import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import {
  calendarEvents,
  microsoftCalendarConnections,
  microsoftCalendarEvents,
  users,
} from "src/storage/schema";

import type {
  MappedMicrosoftCalendarEvent,
  MicrosoftCalendarConnectionCreateInput,
  MicrosoftCalendarConnectionUpdate,
} from "../types/microsoft-calendar.types";

@Injectable()
export class MicrosoftCalendarRepository {
  constructor(
    @Inject(DB) private readonly db: DatabasePg,
    @Inject(DB_ADMIN) private readonly dbAdmin: DatabasePg,
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
