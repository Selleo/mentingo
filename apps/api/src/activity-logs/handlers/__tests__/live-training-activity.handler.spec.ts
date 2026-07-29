import { Test } from "@nestjs/testing";

import { ActivityLogsService } from "src/activity-logs/activity-logs.service";
import { LiveTrainingActivityHandler } from "src/activity-logs/handlers/live-training-activity.handler";
import { ACTIVITY_LOG_ACTION_TYPES, ACTIVITY_LOG_RESOURCE_TYPES } from "src/activity-logs/types";
import { UpdateLiveTrainingEvent } from "src/events";
import { LiveTrainingService } from "src/live-training/live-training.service";

describe("LiveTrainingActivityHandler", () => {
  let handler: LiveTrainingActivityHandler;
  let recordActivity: jest.Mock;

  const actor = {
    userId: "00000000-0000-0000-0000-000000000001",
    email: "admin@example.com",
    roleSlugs: ["admin"],
    permissions: [],
    tenantId: "00000000-0000-0000-0000-000000000010",
  };

  const liveTrainingId = "00000000-0000-0000-0000-000000000101";

  beforeEach(async () => {
    recordActivity = jest.fn();
    const module = await Test.createTestingModule({
      providers: [
        LiveTrainingActivityHandler,
        {
          provide: ActivityLogsService,
          useValue: { recordActivity },
        },
        {
          provide: LiveTrainingService,
          useValue: {},
        },
      ],
    }).compile();

    handler = module.get(LiveTrainingActivityHandler);
  });

  it("records update context together with changed fields", async () => {
    const event = new UpdateLiveTrainingEvent({
      liveTrainingId,
      actor,
      previousLiveTrainingData: {
        id: liveTrainingId,
        title: "Customer service training",
        location: "Room 1",
        description: null,
        status: "scheduled",
        deliveryType: "offline",
        visibilityScope: "linked_courses",
        startsAt: "2026-08-01T10:00:00.000Z",
        endsAt: "2026-08-01T11:00:00.000Z",
        allDay: false,
        timezone: "UTC",
        maxParticipants: 10,
        authorId: actor.userId,
        hostIds: [],
        linkedCourseIds: [],
        settings: {},
      },
      updatedLiveTrainingData: {
        id: liveTrainingId,
        title: "Customer service training",
        location: "Room 2",
        description: null,
        status: "scheduled",
        deliveryType: "offline",
        visibilityScope: "linked_courses",
        startsAt: "2026-08-01T10:00:00.000Z",
        endsAt: "2026-08-01T11:00:00.000Z",
        allDay: false,
        timezone: "UTC",
        maxParticipants: 10,
        authorId: actor.userId,
        hostIds: [],
        linkedCourseIds: [],
        settings: {},
      },
    });

    await handler.handle(event);

    expect(recordActivity).toHaveBeenCalledWith({
      actor,
      operation: ACTIVITY_LOG_ACTION_TYPES.UPDATE,
      resourceType: ACTIVITY_LOG_RESOURCE_TYPES.LIVE_TRAINING,
      resourceId: liveTrainingId,
      changedFields: ["location"],
      before: { location: "Room 1" },
      after: { location: "Room 2" },
      context: { title: "Customer service training" },
    });
  });
});
