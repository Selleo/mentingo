import { Test } from "@nestjs/testing";

import { ActivityLogsService } from "src/activity-logs/activity-logs.service";
import { CourseActivityHandler } from "src/activity-logs/handlers/course-activity.handler";
import { ACTIVITY_LOG_ACTION_TYPES, ACTIVITY_LOG_RESOURCE_TYPES } from "src/activity-logs/types";
import { BulkUpdateCourseStatusEvent } from "src/events";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

describe("CourseActivityHandler", () => {
  it("records one aggregate activity log for bulk course status updates", async () => {
    const recordActivity = jest.fn();
    const runWithTenant = jest.fn((_: string, callback: () => Promise<void>) => callback());
    const module = await Test.createTestingModule({
      providers: [
        CourseActivityHandler,
        {
          provide: ActivityLogsService,
          useValue: { recordActivity },
        },
        {
          provide: TenantDbRunnerService,
          useValue: { runWithTenant },
        },
      ],
    }).compile();
    const handler = module.get(CourseActivityHandler);

    const actor = {
      userId: "00000000-0000-0000-0000-000000000001",
      email: "admin@example.com",
      roleSlugs: ["admin"],
      permissions: [],
      tenantId: "00000000-0000-0000-0000-000000000010",
    };
    const updates = [
      {
        courseId: "00000000-0000-0000-0000-000000000101",
        previousCourseData: {
          id: "00000000-0000-0000-0000-000000000101",
          status: "draft",
        },
        updatedCourseData: {
          id: "00000000-0000-0000-0000-000000000101",
          status: "private",
        },
      },
      {
        courseId: "00000000-0000-0000-0000-000000000102",
        previousCourseData: {
          id: "00000000-0000-0000-0000-000000000102",
          status: "published",
        },
        updatedCourseData: {
          id: "00000000-0000-0000-0000-000000000102",
          status: "private",
        },
      },
    ];

    await handler.handle(
      new BulkUpdateCourseStatusEvent({
        actor,
        tenantId: actor.tenantId,
        status: "private",
        requestedCount: 3,
        updatedCount: 2,
        skippedCount: 1,
        updates,
      }),
    );

    expect(runWithTenant).toHaveBeenCalledWith(actor.tenantId, expect.any(Function));
    expect(recordActivity).toHaveBeenCalledTimes(1);
    expect(recordActivity).toHaveBeenCalledWith({
      actor,
      tenantId: actor.tenantId,
      operation: ACTIVITY_LOG_ACTION_TYPES.BULK_COURSE_STATUS_UPDATE,
      resourceType: ACTIVITY_LOG_RESOURCE_TYPES.COURSE,
      resourceId: null,
      changedFields: ["status"],
      before: {
        courseStatuses: JSON.stringify([
          { courseId: "00000000-0000-0000-0000-000000000101", status: "draft" },
          { courseId: "00000000-0000-0000-0000-000000000102", status: "published" },
        ]),
      },
      after: {
        status: "private",
        courseStatuses: JSON.stringify([
          { courseId: "00000000-0000-0000-0000-000000000101", status: "private" },
          { courseId: "00000000-0000-0000-0000-000000000102", status: "private" },
        ]),
      },
      context: {
        status: "private",
        requestedCount: "3",
        updatedCount: "2",
        skippedCount: "1",
        courseIds: JSON.stringify([
          "00000000-0000-0000-0000-000000000101",
          "00000000-0000-0000-0000-000000000102",
        ]),
      },
    });
  });

  it("skips activity logging when no course statuses changed", async () => {
    const recordActivity = jest.fn();
    const runWithTenant = jest.fn((_: string, callback: () => Promise<void>) => callback());
    const module = await Test.createTestingModule({
      providers: [
        CourseActivityHandler,
        {
          provide: ActivityLogsService,
          useValue: { recordActivity },
        },
        {
          provide: TenantDbRunnerService,
          useValue: { runWithTenant },
        },
      ],
    }).compile();
    const handler = module.get(CourseActivityHandler);

    await handler.handle(
      new BulkUpdateCourseStatusEvent({
        actor: {
          userId: "00000000-0000-0000-0000-000000000001",
          email: "admin@example.com",
          roleSlugs: ["admin"],
          permissions: [],
          tenantId: "00000000-0000-0000-0000-000000000010",
        },
        tenantId: "00000000-0000-0000-0000-000000000010",
        status: "private",
        requestedCount: 1,
        updatedCount: 0,
        skippedCount: 1,
        updates: [],
      }),
    );

    expect(runWithTenant).not.toHaveBeenCalled();
    expect(recordActivity).not.toHaveBeenCalled();
  });
});
