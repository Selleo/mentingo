import { FormatRegistry } from "@sinclair/typebox";
import { validate } from "uuid";

import { CourseAuthoringDraftLifecycleService } from "./course-authoring-draft-lifecycle.service";

const tenantId = "00000000-0000-4000-8000-000000000001";
const draftId = "00000000-0000-4000-8000-000000000002";
const sessionId = "00000000-0000-4000-8000-000000000003";
const ownerId = "00000000-0000-4000-8000-000000000004";
const eventId = "00000000-0000-4000-8000-000000000005";
const requestId = "00000000-0000-4000-8000-000000000006";
const proposalId = "00000000-0000-4000-8000-000000000007";

const draft = { id: draftId, lumaSessionId: sessionId, cursorSequence: 1, tenantId, ownerId };
const snapshot = { courseId: draftId, sessionId, status: "active", tasks: [] };

function setup() {
  const repo = {
    inactive: jest.fn().mockResolvedValue([draft]),
    expire: jest.fn().mockResolvedValue(draft),
    markDiscarded: jest.fn().mockResolvedValue(undefined),
    touch: jest.fn().mockResolvedValue(draft),
    pollable: jest.fn().mockResolvedValue([draft]),
    markPolled: jest.fn().mockResolvedValue(undefined),
  };
  const applicationRepo = {
    draftStagedAssets: jest.fn().mockResolvedValue([]),
    cleanExpiredStagedAsset: jest.fn().mockResolvedValue(undefined),
  };
  const tenants = {
    runForEachTenant: jest.fn(async (callback: (id: string) => Promise<void>) =>
      callback(tenantId),
    ),
  };
  const luma = {
    authoring: {
      getSession: jest.fn().mockResolvedValue(snapshot),
      sendCommand: jest.fn().mockResolvedValue(undefined),
      getEvents: jest.fn().mockResolvedValue({
        events: [
          {
            schemaVersion: 1,
            eventId,
            sessionId,
            sequence: 2,
            occurredAt: "2026-11-20T12:00:00Z",
            type: "autonomous.apply_requested",
            payload: {
              schemaVersion: 1,
              courseId: draftId,
              sessionId,
              requestId,
              controlEpoch: 2,
              actorId: ownerId,
              proposalIds: [proposalId],
            },
          },
        ],
        hasMore: false,
        nextSequence: 2,
      }),
    },
  };
  const queue = { enqueue: jest.fn().mockResolvedValue(undefined) };
  const service = new CourseAuthoringDraftLifecycleService(
    repo as never,
    applicationRepo as never,
    tenants as never,
    queue as never,
    { getLumaClient: jest.fn().mockResolvedValue(luma) } as never,
    {} as never,
  );
  return { service, repo, luma: luma.authoring, queue, applicationRepo };
}

describe(CourseAuthoringDraftLifecycleService.name, () => {
  beforeAll(() => FormatRegistry.Set("uuid", validate));

  it("queues the owner-bound autonomous event before persisting its draft cursor", async () => {
    const { service, repo, queue } = setup();
    await service.pollDraftEvents();
    expect(queue.enqueue).toHaveBeenCalledWith(
      "course-authoring-autonomous",
      "apply-autonomous-request",
      expect.objectContaining({ tenantId, courseId: draftId, sessionId, actorId: ownerId }),
      expect.objectContaining({ jobId: `autonomous-${tenantId}-${eventId}` }),
    );
    expect(repo.markPolled).toHaveBeenCalledWith(tenantId, draftId, 1, 2);
    expect(queue.enqueue.mock.invocationCallOrder[0]).toBeLessThan(
      repo.markPolled.mock.invocationCallOrder[0],
    );
  });

  it("holds the cursor when durable handoff fails", async () => {
    const { service, repo, queue } = setup();
    queue.enqueue.mockRejectedValueOnce(new Error("Redis temporarily unavailable"));
    await service.pollDraftEvents();
    expect(repo.markPolled).toHaveBeenCalledWith(tenantId, draftId, 1, 1);
  });

  it("keeps a draft with pending producer work", async () => {
    const { service, repo, luma } = setup();
    luma.getSession.mockResolvedValueOnce({ ...snapshot, pendingWork: true });
    await service.discardInactiveDrafts();
    expect(repo.touch).toHaveBeenCalledWith(tenantId, draftId, sessionId);
    expect(repo.expire).not.toHaveBeenCalled();
    expect(luma.sendCommand).not.toHaveBeenCalled();
  });

  it("honors owner activity that races with the expiry scan", async () => {
    const { service, repo, luma } = setup();
    repo.expire.mockResolvedValueOnce(null);
    await service.discardInactiveDrafts();
    expect(luma.sendCommand).not.toHaveBeenCalled();
  });

  it("discards an expired draft and retires its unapplied staging", async () => {
    const { service, repo, luma, applicationRepo } = setup();
    applicationRepo.draftStagedAssets.mockResolvedValueOnce([{ id: eventId, key: "cover" }]);
    await service.discardInactiveDrafts();
    expect(luma.sendCommand).toHaveBeenCalledWith({
      sessionId,
      command: expect.objectContaining({ action: "draft.discard", actorId: ownerId }),
    });
    expect(applicationRepo.cleanExpiredStagedAsset).toHaveBeenCalledWith(
      tenantId,
      eventId,
      expect.any(Date),
      expect.any(Function),
    );
    expect(repo.markDiscarded).toHaveBeenCalledWith(tenantId, draftId);
  });
});
