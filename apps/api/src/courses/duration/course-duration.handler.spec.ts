import { CourseDurationRefreshRequestedEvent } from "src/events";

import { CourseDurationHandler } from "./course-duration.handler";

describe("CourseDurationHandler", () => {
  it("refreshes the imported course when a durable refresh event is handled", async () => {
    const refreshCourseDurationEstimates = jest.fn().mockResolvedValue(undefined);
    const handler = new CourseDurationHandler(
      { refreshCourseDurationEstimates } as never,
      {} as never,
    );

    const courseId = "course-id" as never;
    await handler.handle(new CourseDurationRefreshRequestedEvent({ courseId }));

    expect(refreshCourseDurationEstimates).toHaveBeenCalledWith(courseId);
  });
});
