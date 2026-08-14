import { DASHBOARD_CALENDAR_VIEWS, SUPPORTED_LANGUAGES } from "@repo/shared";
import { describe, expect, it } from "vitest";

import { dashboardEventCalendarQueryOptions } from "./useDashboardEventCalendar";

const params = {
  start: "2026-08-01T00:00:00.000Z",
  end: "2026-08-31T23:59:59.999Z",
  language: SUPPORTED_LANGUAGES.EN,
  timezone: "Europe/Warsaw",
};

describe("dashboardEventCalendarQueryOptions", () => {
  it("keeps previous upcoming data while the selected day changes", () => {
    const options = dashboardEventCalendarQueryOptions({
      ...params,
      selectedDate: "2026-08-13",
      view: DASHBOARD_CALENDAR_VIEWS.UPCOMING,
    });
    const previousData = [{ id: "previous-event" }];

    if (typeof options.placeholderData !== "function") {
      throw new Error("Expected upcoming events to retain previous data");
    }

    expect(options.placeholderData(previousData as never)).toBe(previousData);
  });
});
