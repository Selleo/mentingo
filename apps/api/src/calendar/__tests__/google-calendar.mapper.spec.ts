import { OUTLOOK_EVENT_AVAILABILITIES, OUTLOOK_EVENT_SENSITIVITIES } from "@repo/shared";

import { GOOGLE_CALENDAR_MANAGED_EVENT_PROPERTY } from "../calendar.constants";
import {
  isGoogleCalendarEventRemoved,
  mapGoogleCalendarEvent,
} from "../mappers/google-calendar.mapper";

import type { GoogleCalendarEvent } from "../types/google-calendar.types";

const CALENDAR_TIMEZONE = "Europe/Warsaw";

const event = (overrides: Partial<GoogleCalendarEvent> = {}): GoogleCalendarEvent => ({
  id: "event-1",
  status: "confirmed",
  summary: "Planning session",
  location: "Room 4",
  start: { dateTime: "2026-07-22T09:00:00Z", timeZone: "UTC" },
  end: { dateTime: "2026-07-22T10:00:00Z", timeZone: "UTC" },
  visibility: "default",
  htmlLink: "https://www.google.com/calendar/event?eid=abc",
  ...overrides,
});

describe("mapGoogleCalendarEvent", () => {
  it("maps a timed Google event to the shared external event projection", () => {
    expect(mapGoogleCalendarEvent(event(), CALENDAR_TIMEZONE)).toEqual({
      externalEventId: "event-1",
      title: "Planning session",
      startsAt: "2026-07-22T09:00:00.000Z",
      endsAt: "2026-07-22T10:00:00.000Z",
      allDay: false,
      timezone: "UTC",
      location: "Room 4",
      isCancelled: false,
      availability: OUTLOOK_EVENT_AVAILABILITIES.BUSY,
      sensitivity: OUTLOOK_EVENT_SENSITIVITIES.NORMAL,
      webLink: "https://www.google.com/calendar/event?eid=abc",
    });
  });

  it("maps all-day events to UTC midnight and falls back to the calendar timezone", () => {
    expect(
      mapGoogleCalendarEvent(
        event({ start: { date: "2026-07-22" }, end: { date: "2026-07-23" } }),
        CALENDAR_TIMEZONE,
      ),
    ).toEqual(
      expect.objectContaining({
        startsAt: "2026-07-22T00:00:00.000Z",
        endsAt: "2026-07-23T00:00:00.000Z",
        allDay: true,
        timezone: CALENDAR_TIMEZONE,
      }),
    );
  });

  it.each([
    ["private", OUTLOOK_EVENT_SENSITIVITIES.PRIVATE],
    ["confidential", OUTLOOK_EVENT_SENSITIVITIES.CONFIDENTIAL],
  ] as const)("masks %s events before persistence", (visibility, sensitivity) => {
    expect(mapGoogleCalendarEvent(event({ visibility }), CALENDAR_TIMEZONE)).toEqual(
      expect.objectContaining({
        title: "Private event",
        location: null,
        webLink: null,
        sensitivity,
      }),
    );
  });

  it("maps transparent events as free and tentative events as tentative", () => {
    expect(
      mapGoogleCalendarEvent(event({ transparency: "transparent" }), CALENDAR_TIMEZONE)
        ?.availability,
    ).toBe(OUTLOOK_EVENT_AVAILABILITIES.FREE);
    expect(
      mapGoogleCalendarEvent(event({ status: "tentative" }), CALENDAR_TIMEZONE)?.availability,
    ).toBe(OUTLOOK_EVENT_AVAILABILITIES.TENTATIVE);
  });

  it("uses a fallback title for events without a summary", () => {
    expect(mapGoogleCalendarEvent(event({ summary: "  " }), CALENDAR_TIMEZONE)?.title).toBe(
      "Untitled event",
    );
  });

  it.each([
    "https://example.com/calendar/event?eid=abc",
    "http://calendar.google.com/calendar/event?eid=abc",
    "javascript:alert(1)",
  ])("drops unsafe link %s", (htmlLink) => {
    expect(mapGoogleCalendarEvent(event({ htmlLink }), CALENDAR_TIMEZONE)?.webLink).toBeNull();
  });

  it("returns null for cancelled events", () => {
    const cancelledEvent = event({ status: "cancelled" });

    expect(isGoogleCalendarEventRemoved(cancelledEvent)).toBe(true);
    expect(mapGoogleCalendarEvent(cancelledEvent, CALENDAR_TIMEZONE)).toBeNull();
  });

  it("excludes Mentingo-managed Google copies from inbound import", () => {
    expect(
      mapGoogleCalendarEvent(
        event({
          extendedProperties: { private: { [GOOGLE_CALENDAR_MANAGED_EVENT_PROPERTY]: "true" } },
        }),
        CALENDAR_TIMEZONE,
      ),
    ).toBeNull();
  });

  it("returns null when Google omits the event time range", () => {
    expect(mapGoogleCalendarEvent(event({ start: undefined }), CALENDAR_TIMEZONE)).toBeNull();
  });
});
