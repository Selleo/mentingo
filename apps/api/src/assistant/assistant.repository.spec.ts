import { ASSISTANT_RUN_ACTIVITIES } from "@repo/shared";
import { PgDialect } from "drizzle-orm/pg-core";

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

  it("terminal reconciliation retains previously persisted answer text and sources", async () => {
    await repository.updateRun(identity, { status: "failed", errorCode: "WORKFLOW_FAILED" });
    expect(set.mock.calls[0][0]).toEqual(
      expect.objectContaining({ status: "failed", errorCode: "WORKFLOW_FAILED", activity: null }),
    );
    expect(set.mock.calls[1][0]).toEqual(
      expect.objectContaining({ status: "failed", text: undefined, sources: undefined }),
    );
  });

  it.each(["completed", "cancelled"] as const)(
    "does not overwrite a Core %s state with a late Workflow failure",
    async (status) => {
      current = { ...current, status, activity: null };
      await expect(
        repository.updateRun(identity, { status: "failed", errorCode: "WORKFLOW_FAILED" }),
      ).resolves.toEqual(current);
      expect(set).not.toHaveBeenCalled();
    },
  );
});

describe("Assistant reconciliation scan boundaries", () => {
  it("bounds and tenant-scopes stale bound runs while advancing past a stable cursor", async () => {
    const where = jest.fn();
    const orderBy = jest.fn();
    const limit = jest.fn(async () => []);
    const query = {
      from: jest.fn(),
      where,
      orderBy,
      limit,
    };
    query.from.mockReturnValue(query);
    where.mockReturnValue(query);
    orderBy.mockReturnValue(query);
    const runWithTenant = jest.fn((_tenantId, callback) => callback());
    const repository = new AssistantRepository(
      { select: () => query } as never,
      { runWithTenant } as never,
    );
    const cursor = { createdAt: "2026-10-23T12:00:00Z", id: "run-cursor" };
    await repository.boundActiveRuns("tenant-isolated", cursor);
    expect(runWithTenant).toHaveBeenCalledWith("tenant-isolated", expect.any(Function));
    expect(limit).toHaveBeenCalledWith(20);
    const statement = new PgDialect().sqlToQuery(where.mock.calls[0][0]);
    expect(statement.params).toEqual([
      "tenant-isolated",
      "pending",
      "running",
      cursor.createdAt,
      cursor.createdAt,
      cursor.id,
    ]);
    expect(statement.sql).toContain('"workflow_run_id" is not null');
    expect(statement.sql).toContain("CURRENT_TIMESTAMP - interval '15 seconds'");
    expect(statement.sql).toContain('"created_at" >');
    expect(statement.sql).toContain('"id" >');
    expect(orderBy.mock.calls[0]).toHaveLength(2);
  });
});
