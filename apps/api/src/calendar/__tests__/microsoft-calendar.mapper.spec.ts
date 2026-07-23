import { OUTLOOK_EVENT_AVAILABILITIES, OUTLOOK_EVENT_SENSITIVITIES } from "@repo/shared";

import { MICROSOFT_MENTINGO_MARKER_PROPERTY } from "../clients/microsoft-graph-api.client";
import { mapMicrosoftGraphEvent } from "../mappers/microsoft-calendar.mapper";

import type { MicrosoftGraphEvent } from "../types/microsoft-calendar.types";

const event = (overrides: Partial<MicrosoftGraphEvent> = {}): MicrosoftGraphEvent => ({
  id: "event-1",
  subject: "Planning session",
  start: { dateTime: "2026-07-22T09:00:00", timeZone: "UTC" },
  end: { dateTime: "2026-07-22T10:00:00", timeZone: "UTC" },
  showAs: "busy",
  sensitivity: "normal",
  webLink: "https://outlook.office.com/calendar/item/1",
  ...overrides,
});

describe("mapMicrosoftGraphEvent", () => {
  it("maps the minimal Outlook projection and availability", () => {
    expect(
      mapMicrosoftGraphEvent(event({ showAs: "workingElsewhere", isCancelled: true })),
    ).toEqual(
      expect.objectContaining({
        externalEventId: "event-1",
        title: "Planning session",
        startsAt: "2026-07-22T09:00:00.000Z",
        endsAt: "2026-07-22T10:00:00.000Z",
        availability: OUTLOOK_EVENT_AVAILABILITIES.WORKING_ELSEWHERE,
        isCancelled: true,
      }),
    );
  });

  it.each(["private", "confidential"] as const)(
    "masks %s events before persistence",
    (sensitivity) => {
      expect(
        mapMicrosoftGraphEvent(
          event({
            sensitivity,
            location: { displayName: "Board room" },
          }),
        ),
      ).toEqual(
        expect.objectContaining({
          title: "Private event",
          location: null,
          webLink: null,
          sensitivity:
            sensitivity === "private"
              ? OUTLOOK_EVENT_SENSITIVITIES.PRIVATE
              : OUTLOOK_EVENT_SENSITIVITIES.CONFIDENTIAL,
        }),
      );
    },
  );

  it("drops unsafe non-Outlook links", () => {
    expect(
      mapMicrosoftGraphEvent(event({ webLink: "https://example.com/phishing" }))?.webLink,
    ).toBe(null);
  });

  it("returns null for delta tombstones", () => {
    expect(mapMicrosoftGraphEvent(event({ "@removed": { reason: "deleted" } }))).toBeNull();
  });

  it("excludes Mentingo-managed Outlook copies from inbound import", () => {
    expect(
      mapMicrosoftGraphEvent(
        event({
          singleValueExtendedProperties: [
            { id: MICROSOFT_MENTINGO_MARKER_PROPERTY, value: "true" },
          ],
        }),
      ),
    ).toBeNull();
  });
});
