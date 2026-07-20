import { Test } from "@nestjs/testing";

import { ActivityLogsService } from "src/activity-logs/activity-logs.service";
import { LearningPathActivityHandler } from "src/activity-logs/handlers/learning-path-activity.handler";
import { ACTIVITY_LOG_ACTION_TYPES, ACTIVITY_LOG_RESOURCE_TYPES } from "src/activity-logs/types";
import {
  CreateLearningPathEvent,
  UpdateLearningPathEvent,
  DeleteLearningPathEvent,
  EnrollLearningPathEvent,
  StartLearningPathEvent,
  CompleteLearningPathEvent,
} from "src/events";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

describe("LearningPathActivityHandler", () => {
  let handler: LearningPathActivityHandler;
  let recordActivity: jest.Mock;

  const actor = {
    userId: "00000000-0000-0000-0000-000000000001",
    email: "admin@example.com",
    roleSlugs: ["admin"],
    permissions: [],
    tenantId: "00000000-0000-0000-0000-000000000010",
  };

  const learningPathId = "00000000-0000-0000-0000-000000000101";

  beforeEach(async () => {
    recordActivity = jest.fn();
    const module = await Test.createTestingModule({
      providers: [
        LearningPathActivityHandler,
        {
          provide: ActivityLogsService,
          useValue: { recordActivity },
        },
        {
          provide: TenantDbRunnerService,
          useValue: {
            runWithTenant: jest.fn((_: string, callback: () => Promise<void>) => callback()),
          },
        },
      ],
    }).compile();

    handler = module.get(LearningPathActivityHandler);
  });

  it("handles CreateLearningPathEvent", async () => {
    const event = new CreateLearningPathEvent({
      learningPathId,
      actor,
      createdLearningPath: {
        id: learningPathId,
        title: "New Path",
      },
    });

    await handler.handle(event);

    expect(recordActivity).toHaveBeenCalledWith({
      actor,
      tenantId: actor.tenantId,
      operation: ACTIVITY_LOG_ACTION_TYPES.CREATE,
      resourceType: ACTIVITY_LOG_RESOURCE_TYPES.LEARNING_PATH,
      resourceId: learningPathId,
      after: {
        id: learningPathId,
        title: "New Path",
      },
      context: null,
    });
  });

  it("handles UpdateLearningPathEvent", async () => {
    const event = new UpdateLearningPathEvent({
      learningPathId,
      actor,
      previousLearningPathData: {
        id: learningPathId,
        title: "Old Path",
      },
      updatedLearningPathData: {
        id: learningPathId,
        title: "Updated Path",
      },
    });

    await handler.handle(event);

    expect(recordActivity).toHaveBeenCalledWith({
      actor,
      tenantId: actor.tenantId,
      operation: ACTIVITY_LOG_ACTION_TYPES.UPDATE,
      resourceType: ACTIVITY_LOG_RESOURCE_TYPES.LEARNING_PATH,
      resourceId: learningPathId,
      changedFields: ["title"],
      before: {
        title: "Old Path",
      },
      after: {
        title: "Updated Path",
      },
      context: null,
    });
  });

  it("handles DeleteLearningPathEvent", async () => {
    const event = new DeleteLearningPathEvent({
      learningPathId,
      actor,
    });

    await handler.handle(event);

    expect(recordActivity).toHaveBeenCalledWith({
      actor,
      tenantId: actor.tenantId,
      operation: ACTIVITY_LOG_ACTION_TYPES.DELETE,
      resourceType: ACTIVITY_LOG_RESOURCE_TYPES.LEARNING_PATH,
      resourceId: learningPathId,
    });
  });

  it("handles EnrollLearningPathEvent", async () => {
    const userIds = [
      "00000000-0000-0000-0000-000000000002",
      "00000000-0000-0000-0000-000000000003",
    ];
    const event = new EnrollLearningPathEvent({
      learningPathId,
      actor,
      userIds,
    });

    await handler.handle(event);

    expect(recordActivity).toHaveBeenCalledWith({
      actor,
      tenantId: actor.tenantId,
      operation: ACTIVITY_LOG_ACTION_TYPES.ENROLL_LEARNING_PATH,
      resourceType: ACTIVITY_LOG_RESOURCE_TYPES.LEARNING_PATH,
      resourceId: learningPathId,
      context: {
        enrolledUserIds: JSON.stringify(userIds),
        enrolledCount: "2",
      },
    });
  });

  it("handles StartLearningPathEvent", async () => {
    const event = new StartLearningPathEvent({
      learningPathId,
      actor,
      userId: actor.userId,
    });

    await handler.handle(event);

    expect(recordActivity).toHaveBeenCalledWith({
      actor,
      tenantId: actor.tenantId,
      operation: ACTIVITY_LOG_ACTION_TYPES.START_LEARNING_PATH,
      resourceType: ACTIVITY_LOG_RESOURCE_TYPES.LEARNING_PATH,
      resourceId: learningPathId,
      context: { learningPathId },
    });
  });

  it("handles CompleteLearningPathEvent", async () => {
    const event = new CompleteLearningPathEvent({
      learningPathId,
      actor,
      userId: actor.userId,
    });

    await handler.handle(event);

    expect(recordActivity).toHaveBeenCalledWith({
      actor,
      tenantId: actor.tenantId,
      operation: ACTIVITY_LOG_ACTION_TYPES.COMPLETE_LEARNING_PATH,
      resourceType: ACTIVITY_LOG_RESOURCE_TYPES.LEARNING_PATH,
      resourceId: learningPathId,
      context: { learningPathId },
    });
  });
});
