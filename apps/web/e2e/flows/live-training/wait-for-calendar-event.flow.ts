import { expect } from "@playwright/test";

import { getCalendarRangeAround } from "../../utils/calendar-dates";

import type { FixtureApiClient } from "../../utils/api-client";

export const waitForCalendarEventFlow = async (
  apiClient: FixtureApiClient,
  { calendarEventId, startsAt }: { calendarEventId: string; startsAt: string },
) => {
  await expect
    .poll(async () => {
      const response = await apiClient.api.calendarControllerGetEvents({
        ...getCalendarRangeAround(startsAt),
        language: "en",
      });

      return response.data.data.events.some((event) => event.id === calendarEventId);
    })
    .toBe(true);
};
