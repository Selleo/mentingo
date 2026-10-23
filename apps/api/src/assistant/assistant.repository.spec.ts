import { ASSISTANT_RUN_ACTIVITIES } from "@repo/shared";

import { AssistantRepository } from "./assistant.repository";

import type { AssistantRun } from "./assistant.types";

describe("Assistant durable progress", () => {
  const identity = { tenantId: "tenant-1", runId: "run-1" };
  const base: AssistantRun = {
    createdAt: "2026-10-23T12:00:00Z",
    updatedAt: "2026-10-23T12:00:00Z",
    language: "en",
    origin: "https://tenant.example",
    userMessageId: "user-message-1",
    errorCode: null,
    workflowRunId: null,
    id: "run-1",
    tenantId: "tenant-1",
    threadId: "thread-1",
    userId: "user-1",
    assistantMessageId: "message-1",
    status: "running",
    activity: "reading",
    sources: [],
    successfulToolCalls: 0,
    readableToolCalls: 0,
  };
  let current: AssistantRun;
  let set: jest.Mock;
  let repository: AssistantRepository;
  let runWithTenantTransaction: jest.Mock;

  beforeEach(() => {
    current = { ...base };
    const query = { from: () => query, where: () => query, for: async () => [current] };
    set = jest.fn((patch) => ({
      where: () => ({ returning: async () => [{ ...current, ...patch }] }),
    }));
    runWithTenantTransaction = jest.fn((_tenantId, callback) => callback());
    repository = new AssistantRepository(
      { select: () => query, update: () => ({ set }) } as never,
      { runWithTenantTransaction } as never,
    );
  });

  it.each(["completed", "failed", "cancelled"] as const)(
    "clears progress when transitioning to %s",
    async (status) => {
      const result = await repository.updateRun(identity, {
        status,
        activity: ASSISTANT_RUN_ACTIVITIES.WRITING,
      });
      expect(result.activity).toBeNull();
      expect(set.mock.calls[0][0]).toEqual(expect.objectContaining({ status, activity: null }));
      expect(runWithTenantTransaction).toHaveBeenCalledWith(
        identity.tenantId,
        expect.any(Function),
      );
    },
  );

  it.each(["completed", "failed", "cancelled"] as const)(
    "cannot revive %s from a late progress write",
    async (status) => {
      current = { ...current, status, activity: null };
      await expect(
        repository.updateRun(identity, { activity: ASSISTANT_RUN_ACTIVITIES.WRITING }),
      ).resolves.toEqual(current);
      expect(set).not.toHaveBeenCalled();
    },
  );

  it("keeps retrieved candidates in the run registry without exposing all candidates as message sources", async () => {
    const source = { title: "Candidate", url: "https://tenant.example/course/candidate" };
    await repository.updateRun(identity, { sources: [source], recordTool: { readable: false } });
    expect(set.mock.calls[0][0].sources).toEqual([source]);
    expect(set.mock.calls[1][0].sources).toBeUndefined();
    set.mockClear();
    await repository.updateRun(identity, { text: "Final reply", messageSources: [] });
    expect(set.mock.calls[1][0].sources).toEqual([]);
  });

  it("persists real activity for an active run without changing its status", async () => {
    await repository.updateRun(identity, { activity: ASSISTANT_RUN_ACTIVITIES.SEARCHING });
    expect(set.mock.calls[0][0]).toEqual(
      expect.objectContaining({ status: undefined, activity: "searching" }),
    );
  });
});
