import { MasterCourseSyncHandler } from "src/courses/handlers/master-course-sync.handler";
import { BulkUpdateCourseCategoryEvent } from "src/events";

import type { DatabasePg } from "src/common";
import type { MasterCourseService } from "src/courses/master-course.service";

describe("MasterCourseSyncHandler", () => {
  it("queues master-course sync once per changed course for bulk category updates", async () => {
    const queueSyncForSourceCourse = jest.fn();
    const handler = new MasterCourseSyncHandler(
      { queueSyncForSourceCourse } as unknown as MasterCourseService,
      {} as DatabasePg,
    );

    await handler.handle(
      new BulkUpdateCourseCategoryEvent({
        actor: {
          userId: "00000000-0000-0000-0000-000000000001",
          email: "admin@example.com",
          roleSlugs: ["admin"],
          permissions: [],
          tenantId: "00000000-0000-0000-0000-000000000010",
        },
        tenantId: "00000000-0000-0000-0000-000000000010",
        categoryId: "00000000-0000-0000-0000-000000000201",
        requestedCount: 3,
        updatedCount: 3,
        skippedCount: 0,
        updates: [
          {
            courseId: "00000000-0000-0000-0000-000000000101",
            previousCourseData: null,
            updatedCourseData: null,
          },
          {
            courseId: "00000000-0000-0000-0000-000000000101",
            previousCourseData: null,
            updatedCourseData: null,
          },
          {
            courseId: "00000000-0000-0000-0000-000000000102",
            previousCourseData: null,
            updatedCourseData: null,
          },
        ],
      }),
    );

    expect(queueSyncForSourceCourse).toHaveBeenCalledTimes(2);
    expect(queueSyncForSourceCourse).toHaveBeenCalledWith(
      "00000000-0000-0000-0000-000000000101",
      "BulkUpdateCourseCategoryEvent",
    );
    expect(queueSyncForSourceCourse).toHaveBeenCalledWith(
      "00000000-0000-0000-0000-000000000102",
      "BulkUpdateCourseCategoryEvent",
    );
  });
});
