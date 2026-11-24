import { Injectable } from "@nestjs/common";
import { CALENDAR_OUTBOUND_STATUSES, CALENDAR_PROVIDERS } from "@repo/shared";
import { match } from "ts-pattern";

import {
  CALENDAR_OUTBOUND_ERROR_CODES,
  CALENDAR_OUTBOUND_SOURCE_TYPES,
  GOOGLE_CALENDAR_MANAGED_EVENT_PROPERTY,
  GOOGLE_CALENDAR_PRIMARY_CALENDAR_ID,
  MANAGED_CALENDAR_NAME,
} from "../calendar.constants";
import {
  GoogleCalendarApiClient,
  GoogleCalendarApiError,
} from "../clients/google-calendar-api.client";
import { CalendarConnectionRepository } from "../repositories/calendar-connection.repository";
import { buildCalendarSyncWindow } from "../utils/calendar-sync.utils";

import { GoogleCalendarAccessTokenService } from "./google-calendar-access-token.service";

import type {
  CalendarConnection,
  CalendarOutboundCandidate,
} from "../types/calendar-connection.types";
import type {
  GoogleCalendarEventDateTime,
  GoogleCalendarOutboundEvent,
} from "../types/google-calendar.types";
import type { UUIDType } from "src/common";

const DAY_MS = 86_400_000;

@Injectable()
export class GoogleCalendarOutboundService {
  constructor(
    private readonly calendarConnectionRepository: CalendarConnectionRepository,
    private readonly googleCalendarApiClient: GoogleCalendarApiClient,
    private readonly googleCalendarAccessTokenService: GoogleCalendarAccessTokenService,
  ) {}

  async exportMentingoEventsToGoogleCalendar(connectionId: UUIDType) {
    const connection = await this.calendarConnectionRepository.getConnectionById(connectionId);
    if (
      !connection ||
      connection.provider !== CALENDAR_PROVIDERS.GOOGLE ||
      !connection.outboundSyncEnabled
    ) {
      return;
    }

    await this.calendarConnectionRepository.updateConnection(connectionId, {
      outboundStatus: CALENDAR_OUTBOUND_STATUSES.SYNCING,
      outboundErrorCode: null,
    });

    try {
      const accessToken = await this.googleCalendarAccessTokenService.getAccessToken(connection);
      const calendarId = await this.resolveManagedCalendarId(connection, accessToken);
      if (!calendarId) return;

      const exportedEventKeys = await this.exportCandidates(connectionId, calendarId, accessToken);
      await this.removeStaleExportedEvents(
        connectionId,
        calendarId,
        accessToken,
        exportedEventKeys,
      );

      await this.calendarConnectionRepository.updateConnection(connectionId, {
        outboundStatus: CALENDAR_OUTBOUND_STATUSES.CONNECTED,
        lastOutboundSyncAt: new Date().toISOString(),
        outboundErrorCode: null,
      });
    } catch (error) {
      await this.calendarConnectionRepository.updateConnection(connectionId, {
        outboundStatus: CALENDAR_OUTBOUND_STATUSES.ERROR,
        outboundErrorCode:
          error instanceof GoogleCalendarApiError && error.authenticationFailure
            ? CALENDAR_OUTBOUND_ERROR_CODES.AUTHORIZATION_EXPIRED
            : CALENDAR_OUTBOUND_ERROR_CODES.EXPORT_FAILED,
      });
    }
  }

  private async exportCandidates(connectionId: UUIDType, calendarId: string, accessToken: string) {
    const { start, end } = buildCalendarSyncWindow();
    const candidates = await this.calendarConnectionRepository.listOutboundCandidates(
      connectionId,
      start,
      end,
    );
    const exportedEventKeys = new Set<string>();

    for (const candidate of candidates) {
      exportedEventKeys.add(
        this.getExportedEventKey(candidate.calendarEventId, candidate.recipientId),
      );

      const mapping = await this.calendarConnectionRepository.getOutboundMapping(
        connectionId,
        candidate.calendarEventId,
        candidate.recipientId,
      );
      const googleEvent = this.toGoogleCalendarEvent(candidate);

      if (mapping) {
        const updated = await this.updateExportedEvent(
          accessToken,
          calendarId,
          mapping.externalEventId,
          googleEvent,
        );
        if (updated) continue;
      }

      const createdEvent = await this.googleCalendarApiClient.createEvent(
        accessToken,
        calendarId,
        googleEvent,
      );

      await this.calendarConnectionRepository.upsertOutboundMapping({
        connectionId,
        calendarEventId: candidate.calendarEventId,
        userId: candidate.recipientId,
        externalEventId: createdEvent.id,
      });
    }

    return exportedEventKeys;
  }

  private async updateExportedEvent(
    accessToken: string,
    calendarId: string,
    externalEventId: string,
    googleEvent: GoogleCalendarOutboundEvent,
  ) {
    try {
      await this.googleCalendarApiClient.updateEvent(
        accessToken,
        calendarId,
        externalEventId,
        googleEvent,
      );
      return true;
    } catch (error) {
      if (error instanceof GoogleCalendarApiError && error.notFound) return false;
      throw error;
    }
  }

  private async removeStaleExportedEvents(
    connectionId: UUIDType,
    calendarId: string,
    accessToken: string,
    exportedEventKeys: Set<string>,
  ) {
    const mappings = await this.calendarConnectionRepository.listOutboundMappings(connectionId);

    for (const mapping of mappings) {
      if (
        exportedEventKeys.has(this.getExportedEventKey(mapping.calendarEventId, mapping.userId))
      ) {
        continue;
      }

      try {
        await this.googleCalendarApiClient.deleteEvent(
          accessToken,
          calendarId,
          mapping.externalEventId,
        );
      } catch (error) {
        if (!(error instanceof GoogleCalendarApiError) || !error.notFound) throw error;
      }

      await this.calendarConnectionRepository.deleteOutboundMapping(mapping.id);
    }
  }

  private async resolveManagedCalendarId(connection: CalendarConnection, accessToken: string) {
    if (connection.outboundCalendarId) {
      return this.verifyManagedCalendarExists(
        connection,
        connection.outboundCalendarId,
        accessToken,
      );
    }

    const calendars = await this.googleCalendarApiClient.listCalendars(accessToken);
    const existingCalendar = calendars.find(
      (calendar) =>
        calendar.summary === MANAGED_CALENDAR_NAME &&
        !calendar.primary &&
        calendar.accessRole === "owner",
    );

    const calendar =
      existingCalendar ??
      (await this.googleCalendarApiClient.createCalendar(
        accessToken,
        await this.getPrimaryCalendarTimezone(accessToken),
      ));

    await this.calendarConnectionRepository.updateConnection(connection.id, {
      outboundCalendarId: calendar.id,
    });

    return calendar.id;
  }

  private async verifyManagedCalendarExists(
    connection: CalendarConnection,
    calendarId: string,
    accessToken: string,
  ) {
    try {
      await this.googleCalendarApiClient.getCalendar(accessToken, calendarId);
      return calendarId;
    } catch (error) {
      if (!(error instanceof GoogleCalendarApiError) || !error.notFound) throw error;
    }

    await this.calendarConnectionRepository.updateConnection(connection.id, {
      outboundSyncEnabled: false,
      outboundStatus: CALENDAR_OUTBOUND_STATUSES.DISABLED,
      outboundErrorCode: CALENDAR_OUTBOUND_ERROR_CODES.CALENDAR_DELETED,
    });

    return null;
  }

  private async getPrimaryCalendarTimezone(accessToken: string) {
    const primaryCalendar = await this.googleCalendarApiClient.getCalendar(
      accessToken,
      GOOGLE_CALENDAR_PRIMARY_CALENDAR_ID,
    );
    return primaryCalendar.timeZone ?? "UTC";
  }

  private toGoogleCalendarEvent(candidate: CalendarOutboundCandidate): GoogleCalendarOutboundEvent {
    return {
      summary: candidate.title,
      description: this.getEventDescription(candidate),
      ...this.getEventTimeRange(candidate),
      ...(candidate.location ? { location: candidate.location } : {}),
      extendedProperties: { private: { [GOOGLE_CALENDAR_MANAGED_EVENT_PROPERTY]: "true" } },
    };
  }

  private getEventDescription(candidate: CalendarOutboundCandidate) {
    return match(candidate.sourceType)
      .with(CALENDAR_OUTBOUND_SOURCE_TYPES.COURSE_DUE_DATE, () =>
        [
          candidate.description || "Mandatory course due date",
          `Course: ${candidate.courseTitle ?? candidate.title}`,
          `Group: ${candidate.groupName ?? ""}`,
          "This is informational. No action is required in Google Calendar.",
        ].join("\n\n"),
      )
      .with(CALENDAR_OUTBOUND_SOURCE_TYPES.LIVE_TRAINING, () =>
        [
          candidate.description || "Mentingo live training",
          "This session is managed in Mentingo.",
        ].join("\n\n"),
      )
      .exhaustive();
  }

  private getEventTimeRange(
    candidate: CalendarOutboundCandidate,
  ): Pick<GoogleCalendarOutboundEvent, "start" | "end"> {
    if (!candidate.allDay) {
      return {
        start: { dateTime: candidate.startsAt, timeZone: candidate.timezone },
        end: { dateTime: candidate.endsAt, timeZone: candidate.timezone },
      };
    }

    const startDate = this.toCalendarDate(candidate.startsAt, candidate.timezone);
    const endDate = this.toCalendarDate(candidate.endsAt, candidate.timezone);

    return {
      start: { date: startDate },
      end: { date: endDate > startDate ? endDate : this.getNextCalendarDate(startDate) },
    };
  }

  private toCalendarDate(
    value: string,
    timezone: string,
  ): NonNullable<GoogleCalendarEventDateTime["date"]> {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date(value));

    const dateParts = Object.fromEntries(parts.map((part) => [part.type, part.value]));

    return `${dateParts.year}-${dateParts.month}-${dateParts.day}`;
  }

  private getNextCalendarDate(date: string) {
    return new Date(Date.parse(`${date}T00:00:00Z`) + DAY_MS).toISOString().slice(0, 10);
  }

  private getExportedEventKey(calendarEventId: string, userId: string) {
    return `${calendarEventId}:${userId}`;
  }
}
