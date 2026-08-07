import { CALENDAR_EVENT_SOURCE_TYPES } from "@repo/shared";

import { CalendarService } from "./services/calendar.service";

describe("CalendarService dashboard events", () => {
  it("returns only fields consumed by the dashboard calendar widget", async () => {
    const service = new CalendarService({} as never, {} as never);
    jest.spyOn(service, "getEvents").mockResolvedValue({
      events: [
        {
          id: "00000000-0000-0000-0000-000000000001",
          uid: "event-1",
          sourceType: CALENDAR_EVENT_SOURCE_TYPES.COURSE_DUE_DATE,
          sourceId: "00000000-0000-0000-0000-000000000002",
          title: "Compliance deadline",
          description: "Not needed by the widget",
          startsAt: "2026-07-30T10:00:00.000Z",
          endsAt: "2026-07-30T11:00:00.000Z",
          allDay: true,
          timezone: "Europe/Warsaw",
          location: null,
          status: "scheduled",
          payload: {
            courseDueDate: {
              courseId: "00000000-0000-0000-0000-000000000003",
              courseTitle: "Compliance",
              groupId: "00000000-0000-0000-0000-000000000004",
              groupName: "Everyone",
              dueDate: "2026-07-30T10:00:00.000Z",
            },
          },
        },
      ],
    });

    const result = await service.getDashboardEvents(
      {
        start: "2026-07-01T00:00:00.000Z",
        end: "2026-07-31T23:59:59.999Z",
        language: "en",
      },
      {} as never,
    );

    expect(result).toEqual([
      {
        id: "00000000-0000-0000-0000-000000000001",
        sourceType: CALENDAR_EVENT_SOURCE_TYPES.COURSE_DUE_DATE,
        targetId: "00000000-0000-0000-0000-000000000003",
        title: "Compliance deadline",
        startsAt: "2026-07-30T10:00:00.000Z",
        allDay: true,
      },
    ]);
  });
});
