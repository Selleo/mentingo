import {
  OUTLOOK_EVENT_AVAILABILITIES,
  OUTLOOK_EVENT_SENSITIVITIES,
  type OutlookEventAvailability,
  type OutlookEventSensitivity,
} from "@repo/shared";

import { MICROSOFT_MENTINGO_MARKER_PROPERTY } from "../clients/microsoft-graph-api.client";

import type {
  MappedMicrosoftCalendarEvent,
  MicrosoftGraphEvent,
} from "../types/microsoft-calendar.types";

const AVAILABILITY_MAP: Record<string, OutlookEventAvailability> = {
  free: OUTLOOK_EVENT_AVAILABILITIES.FREE,
  tentative: OUTLOOK_EVENT_AVAILABILITIES.TENTATIVE,
  busy: OUTLOOK_EVENT_AVAILABILITIES.BUSY,
  oof: OUTLOOK_EVENT_AVAILABILITIES.OUT_OF_OFFICE,
  workingElsewhere: OUTLOOK_EVENT_AVAILABILITIES.WORKING_ELSEWHERE,
};

const SENSITIVITY_MAP: Record<string, OutlookEventSensitivity> = {
  normal: OUTLOOK_EVENT_SENSITIVITIES.NORMAL,
  personal: OUTLOOK_EVENT_SENSITIVITIES.PERSONAL,
  private: OUTLOOK_EVENT_SENSITIVITIES.PRIVATE,
  confidential: OUTLOOK_EVENT_SENSITIVITIES.CONFIDENTIAL,
};

const OUTLOOK_HOSTS = new Set(["outlook.live.com", "outlook.office.com", "outlook.office365.com"]);

export const mapMicrosoftGraphEvent = (
  event: MicrosoftGraphEvent,
): MappedMicrosoftCalendarEvent | null => {
  if (event["@removed"] || !event.start?.dateTime || !event.end?.dateTime) return null;
  if (
    event.singleValueExtendedProperties?.some(
      (property) => property.id === MICROSOFT_MENTINGO_MARKER_PROPERTY && property.value === "true",
    )
  ) {
    return null;
  }

  const sensitivity =
    SENSITIVITY_MAP[event.sensitivity ?? "normal"] ?? OUTLOOK_EVENT_SENSITIVITIES.NORMAL;
  const isSensitive =
    sensitivity === OUTLOOK_EVENT_SENSITIVITIES.PRIVATE ||
    sensitivity === OUTLOOK_EVENT_SENSITIVITIES.CONFIDENTIAL;

  return {
    externalEventId: event.id,
    title: isSensitive ? "Private event" : event.subject?.trim() || "Untitled event",
    startsAt: normalizeGraphDateTime(event.start.dateTime),
    endsAt: normalizeGraphDateTime(event.end.dateTime),
    allDay: Boolean(event.isAllDay),
    timezone: event.start.timeZone || "UTC",
    location: isSensitive ? null : event.location?.displayName?.trim() || null,
    isCancelled: Boolean(event.isCancelled),
    availability: AVAILABILITY_MAP[event.showAs ?? "busy"] ?? OUTLOOK_EVENT_AVAILABILITIES.BUSY,
    sensitivity,
    webLink: isSensitive ? null : sanitizeOutlookWebLink(event.webLink),
  };
};

const normalizeGraphDateTime = (value: string) => {
  if (/z$|[+-]\d{2}:?\d{2}$/i.test(value)) return new Date(value).toISOString();
  return new Date(`${value}Z`).toISOString();
};

const sanitizeOutlookWebLink = (value: string | null | undefined): string | null => {
  if (!value) return null;

  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !OUTLOOK_HOSTS.has(url.hostname.toLowerCase())) return null;
    return url.toString();
  } catch {
    return null;
  }
};
