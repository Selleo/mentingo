import { Test } from "@nestjs/testing";

import { ActivityLogsService } from "src/activity-logs/activity-logs.service";
import { ScormActivityHandler } from "src/activity-logs/handlers/scorm-activity.handler";
import { ACTIVITY_LOG_ACTION_TYPES, ACTIVITY_LOG_RESOURCE_TYPES } from "src/activity-logs/types";
import {
  CreateScormEvent,
  UpdateScormEvent,
  DeleteScormEvent,
  PlayScormEvent,
  CompleteScormEvent,
} from "src/events";

describe("ScormActivityHandler", () => {
  let handler: ScormActivityHandler;
  let recordActivity: jest.Mock;

  const actor = {
    userId: "00000000-0000-0000-0000-000000000001",
    email: "admin@example.com",
    roleSlugs: ["admin"],
    permissions: [],
    tenantId: "00000000-0000-0000-0000-000000000010",
  };

  const scormId = "00000000-0000-0000-0000-000000000101";

  beforeEach(async () => {
    recordActivity = jest.fn();
    const module = await Test.createTestingModule({
      providers: [
        ScormActivityHandler,
        {
          provide: ActivityLogsService,
          useValue: { recordActivity },
        },
      ],
    }).compile();

    handler = module.get(ScormActivityHandler);
  });

  it("handles CreateScormEvent", async () => {
    const event = new CreateScormEvent({
      scormId,
      actor,
      createdScorm: {
        id: scormId,
        standard: "scorm_1_2",
      },
    });

    await handler.handle(event);

    expect(recordActivity).toHaveBeenCalledWith({
      actor,
      tenantId: actor.tenantId,
      operation: ACTIVITY_LOG_ACTION_TYPES.CREATE,
      resourceType: ACTIVITY_LOG_RESOURCE_TYPES.SCORM,
      resourceId: scormId,
      after: {
        id: scormId,
        standard: "scorm_1_2",
      },
      context: null,
    });
  });

  it("handles UpdateScormEvent", async () => {
    const event = new UpdateScormEvent({
      scormId,
      actor,
      previousScormData: {
        id: scormId,
        status: "importing",
      },
      updatedScormData: {
        id: scormId,
        status: "ready",
      },
    });

    await handler.handle(event);

    expect(recordActivity).toHaveBeenCalledWith({
      actor,
      tenantId: actor.tenantId,
      operation: ACTIVITY_LOG_ACTION_TYPES.UPDATE,
      resourceType: ACTIVITY_LOG_RESOURCE_TYPES.SCORM,
      resourceId: scormId,
      changedFields: ["status"],
      before: {
        status: "importing",
      },
      after: {
        status: "ready",
      },
      context: null,
    });
  });

  it("handles DeleteScormEvent", async () => {
    const event = new DeleteScormEvent({
      scormIds: [{ scormId }],
      actor,
    });

    await handler.handle(event);

    expect(recordActivity).toHaveBeenCalledWith({
      actor,
      tenantId: actor.tenantId,
      operation: ACTIVITY_LOG_ACTION_TYPES.DELETE,
      resourceType: ACTIVITY_LOG_RESOURCE_TYPES.SCORM,
      resourceId: scormId,
      context: {
        deletedScormIds: JSON.stringify([scormId]),
        deletedCount: "1",
      },
    });
  });

  it("handles PlayScormEvent", async () => {
    const event = new PlayScormEvent({
      scormId,
      actor,
      userId: "00000000-0000-0000-0000-000000000002",
    });

    await handler.handle(event);

    expect(recordActivity).toHaveBeenCalledWith({
      actor,
      tenantId: actor.tenantId,
      operation: ACTIVITY_LOG_ACTION_TYPES.PLAY_SCORM,
      resourceType: ACTIVITY_LOG_RESOURCE_TYPES.SCORM,
      resourceId: scormId,
      context: { playedByUserId: "00000000-0000-0000-0000-000000000002" },
    });
  });

  it("handles CompleteScormEvent", async () => {
    const event = new CompleteScormEvent({
      scormId,
      actor,
      userId: "00000000-0000-0000-0000-000000000002",
    });

    await handler.handle(event);

    expect(recordActivity).toHaveBeenCalledWith({
      actor,
      tenantId: actor.tenantId,
      operation: ACTIVITY_LOG_ACTION_TYPES.COMPLETE_SCORM,
      resourceType: ACTIVITY_LOG_RESOURCE_TYPES.SCORM,
      resourceId: scormId,
      context: { completedByUserId: "00000000-0000-0000-0000-000000000002" },
    });
  });
});
