import {
  OUTLOOK_EVENT_AVAILABILITIES,
  OUTLOOK_EVENT_SENSITIVITIES,
  type OutlookEventAvailability,
  type OutlookEventSensitivity,
} from "@repo/shared";
import { match } from "ts-pattern";

import {
  GOOGLE_CALENDAR_EVENT_STATUSES,
  GOOGLE_CALENDAR_EVENT_TRANSPARENCIES,
  GOOGLE_CALENDAR_EVENT_VISIBILITIES,
  GOOGLE_CALENDAR_MANAGED_EVENT_PROPERTY,
} from "../calendar.constants";

import type { MappedExternalCalendarEvent } from "../types/calendar-connection.types";
import type {
  GoogleCalendarEvent,
  GoogleCalendarEventDateTime,
} from "../types/google-calendar.types";

const GOOGLE_CALENDAR_HOSTS = new Set(["calendar.google.com", "www.google.com"]);

export const isGoogleCalendarEventRemoved = (event: GoogleCalendarEvent) =>
  event.status === GOOGLE_CALENDAR_EVENT_STATUSES.CANCELLED;

export const mapGoogleCalendarEvent = (
  event: GoogleCalendarEvent,
  calendarTimezone: string,
): MappedExternalCalendarEvent | null => {
  if (isGoogleCalendarEventRemoved(event)) return null;
  if (event.extendedProperties?.private?.[GOOGLE_CALENDAR_MANAGED_EVENT_PROPERTY] === "true") {
    return null;
  }

  const startsAt = toIsoDateTime(event.start);
  const endsAt = toIsoDateTime(event.end);
  if (!startsAt || !endsAt) return null;

  const sensitivity = getSensitivity(event);
  const isSensitive = sensitivity !== OUTLOOK_EVENT_SENSITIVITIES.NORMAL;

  return {
    externalEventId: event.id,
    title: isSensitive ? "Private event" : event.summary?.trim() || "Untitled event",
    startsAt,
    endsAt,
    allDay: Boolean(event.start?.date),
    timezone: event.start?.timeZone || calendarTimezone || "UTC",
    location: isSensitive ? null : event.location?.trim() || null,
    isCancelled: false,
    availability: getAvailability(event),
    sensitivity,
    webLink: isSensitive ? null : sanitizeGoogleCalendarWebLink(event.htmlLink),
  };
};

const toIsoDateTime = (value: GoogleCalendarEventDateTime | undefined) => {
  if (value?.dateTime) return new Date(value.dateTime).toISOString();
  if (value?.date) return new Date(`${value.date}T00:00:00Z`).toISOString();
  return null;
};

const getSensitivity = (event: GoogleCalendarEvent): OutlookEventSensitivity =>
  match(event.visibility)
    .with(GOOGLE_CALENDAR_EVENT_VISIBILITIES.PRIVATE, () => OUTLOOK_EVENT_SENSITIVITIES.PRIVATE)
    .with(
      GOOGLE_CALENDAR_EVENT_VISIBILITIES.CONFIDENTIAL,
      () => OUTLOOK_EVENT_SENSITIVITIES.CONFIDENTIAL,
    )
    .otherwise(() => OUTLOOK_EVENT_SENSITIVITIES.NORMAL);

const getAvailability = (event: GoogleCalendarEvent): OutlookEventAvailability => {
  if (event.transparency === GOOGLE_CALENDAR_EVENT_TRANSPARENCIES.TRANSPARENT) {
    return OUTLOOK_EVENT_AVAILABILITIES.FREE;
  }

  return match(event.status)
    .with(GOOGLE_CALENDAR_EVENT_STATUSES.TENTATIVE, () => OUTLOOK_EVENT_AVAILABILITIES.TENTATIVE)
    .otherwise(() => OUTLOOK_EVENT_AVAILABILITIES.BUSY);
};

const sanitizeGoogleCalendarWebLink = (value: string | null | undefined): string | null => {
  if (!value) return null;

  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !GOOGLE_CALENDAR_HOSTS.has(url.hostname.toLowerCase())) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
};
