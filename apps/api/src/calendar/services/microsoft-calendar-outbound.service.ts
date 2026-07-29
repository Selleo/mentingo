import { Injectable } from "@nestjs/common";
import { MICROSOFT_CALENDAR_OUTBOUND_STATUSES } from "@repo/shared";
import { escape as escapeHtml } from "lodash";

import {
  MICROSOFT_CALENDAR_NAME,
  MICROSOFT_CALENDAR_OUTBOUND_ERROR_CODES,
  MICROSOFT_CALENDAR_OUTBOUND_SOURCE_TYPES,
} from "../calendar.constants";
import {
  MicrosoftGraphApiClient,
  MicrosoftGraphError,
} from "../clients/microsoft-graph-api.client";
import { MicrosoftCalendarRepository } from "../repositories/microsoft-calendar.repository";

import { MicrosoftCalendarTokenEncryptionService } from "./microsoft-calendar-token-encryption.service";

import type { OutboundCandidate } from "../types/microsoft-calendar.types";

@Injectable()
export class MicrosoftCalendarOutboundService {
  constructor(
    private readonly microsoftCalendarRepository: MicrosoftCalendarRepository,
    private readonly microsoftGraphApiClient: MicrosoftGraphApiClient,
    private readonly microsoftCalendarTokenEncryptionService: MicrosoftCalendarTokenEncryptionService,
  ) {}

  async reconcileConnection(connectionId: string) {
    const connection = await this.microsoftCalendarRepository.getConnectionById(connectionId);
    if (!connection || !connection.outboundSyncEnabled) return;

    await this.microsoftCalendarRepository.updateConnection(connectionId, {
      outboundStatus: MICROSOFT_CALENDAR_OUTBOUND_STATUSES.SYNCING,
      outboundErrorCode: null,
    });

    try {
      const accessToken = await this.getAccessToken(connection);

      const calendarId = await this.ensureCalendar(
        connectionId,
        connection.outboundCalendarId,
        accessToken,
      );

      if (!calendarId) return;

      const { start, end } = this.buildWindow();
      const candidates = await this.microsoftCalendarRepository.listOutboundCandidates(
        connectionId,
        start,
        end,
      );
      const wanted = new Set<string>();

      for (const candidate of candidates) {
        const key = `${candidate.calendarEventId}:${candidate.recipientId}`;

        wanted.add(key);

        const mapping = await this.microsoftCalendarRepository.getOutboundMapping(
          connectionId,
          candidate.calendarEventId,
          candidate.recipientId,
        );

        const payload = this.toGraphEvent(candidate);

        if (!mapping) {
          const event = await this.runGraphOperation("create event", () =>
            this.microsoftGraphApiClient.createEvent(accessToken, calendarId, payload),
          );

          await this.microsoftCalendarRepository.upsertOutboundMapping({
            connectionId,
            calendarEventId: candidate.calendarEventId,
            userId: candidate.recipientId,
            externalEventId: event.id,
          });
        } else {
          try {
            await this.runGraphOperation("update event", () =>
              this.microsoftGraphApiClient.updateEvent(
                accessToken,
                calendarId,
                mapping.externalEventId,
                payload,
              ),
            );
          } catch (error) {
            if (!(error instanceof MicrosoftGraphError) || error.statusCode !== 404) throw error;

            const recreatedEvent = await this.runGraphOperation("recreate event", () =>
              this.microsoftGraphApiClient.createEvent(accessToken, calendarId, payload),
            );

            await this.microsoftCalendarRepository.upsertOutboundMapping({
              connectionId,
              calendarEventId: candidate.calendarEventId,
              userId: candidate.recipientId,
              externalEventId: recreatedEvent.id,
            });
          }
        }
      }

      for (const mapping of await this.microsoftCalendarRepository.listOutboundMappings(
        connectionId,
      )) {
        if (wanted.has(`${mapping.calendarEventId}:${mapping.userId}`)) continue;

        try {
          await this.runGraphOperation("delete event", () =>
            this.microsoftGraphApiClient.deleteEvent(
              accessToken,
              calendarId,
              mapping.externalEventId,
            ),
          );
        } catch (error) {
          if (!(error instanceof MicrosoftGraphError) || error.statusCode !== 404) throw error;
        }

        await this.microsoftCalendarRepository.deleteOutboundMapping(mapping.id);
      }

      await this.microsoftCalendarRepository.updateConnection(connectionId, {
        outboundStatus: MICROSOFT_CALENDAR_OUTBOUND_STATUSES.CONNECTED,
        lastOutboundSyncAt: new Date().toISOString(),
        outboundErrorCode: null,
      });
    } catch (error) {
      await this.microsoftCalendarRepository.updateConnection(connectionId, {
        outboundStatus: MICROSOFT_CALENDAR_OUTBOUND_STATUSES.ERROR,
        outboundErrorCode: this.getOutboundErrorCode(error),
      });
    }
  }

  private getOutboundErrorCode(error: unknown) {
    if (error instanceof MicrosoftGraphError && error.authenticationFailure) {
      return MICROSOFT_CALENDAR_OUTBOUND_ERROR_CODES.AUTHORIZATION_EXPIRED;
    }

    return MICROSOFT_CALENDAR_OUTBOUND_ERROR_CODES.EXPORT_FAILED;
  }

  private async ensureCalendar(
    connectionId: string,
    calendarId: string | null,
    accessToken: string,
  ) {
    if (calendarId) {
      const calendars = await this.microsoftGraphApiClient.listCalendars(accessToken);

      if (calendars.some((calendar) => calendar.id === calendarId)) return calendarId;

      await this.microsoftCalendarRepository.updateConnection(connectionId, {
        outboundSyncEnabled: false,
        outboundStatus: MICROSOFT_CALENDAR_OUTBOUND_STATUSES.DISABLED,
        outboundErrorCode: MICROSOFT_CALENDAR_OUTBOUND_ERROR_CODES.CALENDAR_DELETED,
      });

      return null;
    }

    const calendars = await this.microsoftGraphApiClient.listCalendars(accessToken);

    const existing = calendars.find(
      (calendar) => calendar.name === MICROSOFT_CALENDAR_NAME && !calendar.isDefaultCalendar,
    );
    const calendar = existing ?? (await this.microsoftGraphApiClient.createCalendar(accessToken));

    await this.microsoftCalendarRepository.updateConnection(connectionId, {
      outboundCalendarId: calendar.id,
    });

    return calendar.id;
  }

  private toGraphEvent(candidate: OutboundCandidate) {
    const { title, description } = candidate;
    const body =
      candidate.sourceType === MICROSOFT_CALENDAR_OUTBOUND_SOURCE_TYPES.COURSE_DUE_DATE
        ? `<p>${escapeHtml(description ?? "Mandatory course due date")}</p><p>Course: ${escapeHtml(candidate.courseTitle ?? title)}</p><p>Group: ${escapeHtml(candidate.groupName ?? "")}</p><p>This is informational. No action is required in Outlook.</p>`
        : `<p>${escapeHtml(description ?? "Mentingo live training")}</p><p>This session is managed in Mentingo.</p>`;

    return {
      subject: title,
      body: { contentType: "HTML" as const, content: body },
      start: {
        dateTime: this.toGraphDateTime(candidate.startsAt, candidate.timezone, candidate.allDay),
        timeZone: candidate.timezone,
      },
      end: {
        dateTime: this.toGraphDateTime(candidate.endsAt, candidate.timezone, candidate.allDay),
        timeZone: candidate.timezone,
      },
      isAllDay: candidate.allDay,
      ...(candidate.location ? { location: { displayName: candidate.location } } : {}),
      singleValueExtendedProperties: [
        { id: this.microsoftGraphApiClient.getManagedEventMarkerProperty(), value: "true" },
      ],
    };
  }

  private async getAccessToken(
    connection: Awaited<ReturnType<MicrosoftCalendarRepository["getConnectionById"]>>,
  ) {
    if (!connection) throw new Error("microsoftCalendar.errors.connectionNotFound");

    const refreshToken = this.microsoftCalendarTokenEncryptionService.decrypt(connection);
    const token = await this.microsoftGraphApiClient.refreshAccessToken(refreshToken);

    if (token.refresh_token && token.refresh_token !== refreshToken) {
      await this.microsoftCalendarRepository.updateConnection(
        connection.id,
        this.microsoftCalendarTokenEncryptionService.encrypt(token.refresh_token),
      );
    }

    return token.access_token;
  }

  private async runGraphOperation<T>(operation: string, action: () => Promise<T>): Promise<T> {
    try {
      return await action();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (error instanceof MicrosoftGraphError) {
        throw new MicrosoftGraphError(
          `Outbound ${operation} failed: ${message}`,
          error.authenticationFailure,
          error.adminConsentRequired,
          error.statusCode,
        );
      }

      throw new Error(`Outbound ${operation} failed: ${message}`);
    }
  }

  private buildWindow() {
    const now = new Date();

    const start = new Date(now);
    start.setUTCDate(start.getUTCDate() - 30);

    const end = new Date(now);
    end.setUTCMonth(end.getUTCMonth() + 6);

    return { start: start.toISOString(), end: end.toISOString() };
  }

  private toGraphDateTime(value: string, timezone: string, allDay: boolean) {
    const date = new Date(value);

    if (!allDay) return value;

    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);

    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

    return `${values.year}-${values.month}-${values.day}T00:00:00`;
  }
}
