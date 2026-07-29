import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getEvents: vi.fn(),
}));

vi.mock("~/api/api-client", () => ({
  ApiClient: {
    api: {
      calendarControllerGetEvents: mocks.getEvents,
    },
  },
}));

import { calendarEventsQueryOptions } from "./useCalendarEvents";

describe("calendarEventsQueryOptions", () => {
  beforeEach(() => {
    mocks.getEvents.mockReset();
  });

  it("does not request events before a visible date range exists", async () => {
    const options = calendarEventsQueryOptions({ language: "en" });
    const queryFn = options.queryFn;

    if (typeof queryFn !== "function") throw new Error("Expected calendar query function");

    const events = await queryFn({} as never);

    expect(events).toEqual([]);
    expect(mocks.getEvents).not.toHaveBeenCalled();
  });
});
