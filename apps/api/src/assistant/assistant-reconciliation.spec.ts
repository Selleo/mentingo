import { ConflictException } from "@nestjs/common";

import { AssistantService } from "./assistant.service";

import type { AssistantRun } from "./assistant.types";

const baseRun: AssistantRun = {
  id: "run-1",
  tenantId: "tenant-1",
  userId: "user-1",
  threadId: "thread-1",
  userMessageId: "user-message-1",
  assistantMessageId: "assistant-message-1",
  createdAt: "2026-10-23T12:00:00Z",
  updatedAt: "2026-10-23T12:00:00Z",
  language: "en",
  origin: "https://tenant.example",
  status: "running",
  activity: "writing",
  workflowRunId: "world-run-1",
  errorCode: null,
  sources: [],
  successfulToolCalls: 1,
  readableToolCalls: 0,
};

describe("Assistant bound run reconciliation", () => {
  const actor = { userId: "user-1", tenantId: "tenant-1" };
  let run: AssistantRun;
  let coreAvailable: boolean;
  let message: { text: string; sources: unknown[]; status: string };
  let service: AssistantService;
  let repository: {
    boundActiveRuns: jest.Mock;
    pendingRuns: jest.Mock;
    updateRun: jest.Mock;
    createSend: jest.Mock;
    getRun: jest.Mock;
    bindWorkflow: jest.Mock;
  };
  let runtime: { isAvailable: jest.Mock; getRunState: jest.Mock; start: jest.Mock };

  beforeEach(() => {
    run = { ...baseRun };
    coreAvailable = true;
    message = {
      text: "Already saved partial response",
      sources: [{ title: "Saved source" }],
      status: "running",
    };
    repository = {
      boundActiveRuns: jest.fn(async () => {
        if (!coreAvailable) throw new Error("Core database unavailable");
        return [run].filter(
          (row) => ["pending", "running"].includes(row.status) && row.workflowRunId,
        );
      }),
      pendingRuns: jest.fn(async () => []),
      updateRun: jest.fn(async (_identity, patch) => {
        if (!coreAvailable) throw new Error("Core database unavailable");
        if (["pending", "running"].includes(run.status)) {
          Object.assign(run, patch);
          if (patch.status) message.status = patch.status;
          if (patch.text !== undefined) message.text = patch.text;
          if (patch.messageSources !== undefined) message.sources = patch.messageSources;
        }
        return run;
      }),
      createSend: jest.fn(async () => {
        if (["pending", "running"].includes(run.status)) throw new ConflictException("Run active");
        const nextRun = { ...baseRun, id: "run-2", status: "pending", workflowRunId: null };
        return { run: nextRun, userMessage: {}, assistantMessage: {} };
      }),
      getRun: jest.fn(async ({ runId }) =>
        runId === run.id
          ? run
          : { ...baseRun, id: "run-2", status: "pending", workflowRunId: "world-run-2" },
      ),
      bindWorkflow: jest.fn(async () => undefined),
    };
    runtime = {
      isAvailable: jest.fn(() => true),
      getRunState: jest.fn(async () => "failed"),
      start: jest.fn(async () => ({ workflowRunId: "world-run-2" })),
    };
    const db = {
      select: (selection: Record<string, unknown>) => ({
        from: () => ({
          where: () => ({
            limit: async () =>
              selection.host ? [{ host: "https://tenant.example" }] : [{ id: actor.userId }],
          }),
        }),
      }),
    };
    service = new AssistantService(
      repository as never,
      runtime as never,
      {
        runForEachTenant: async (callback: (tenantId: string) => Promise<void>) =>
          callback(actor.tenantId),
      } as never,
      db as never,
    );
    jest
      .spyOn((service as unknown as { logger: { warn: () => void } }).logger, "warn")
      .mockImplementation(() => undefined);
  });

  it("releases a bound active slot after Core outage prevented failure persistence", async () => {
    coreAvailable = false;
    await expect(repository.updateRun(actor, { status: "failed" })).rejects.toThrow(
      "Core database",
    );
    await service.recoverPendingRuns();
    expect(run.status).toBe("running");
    coreAvailable = true;
    await service.recoverPendingRuns();
    expect(run.status).toBe("failed");
    expect(run.errorCode).toBe("WORKFLOW_FAILED");
    expect(message.text).toBe("Already saved partial response");
    expect(message.sources).toEqual([{ title: "Saved source" }]);
    expect(message.status).toBe("failed");
    await expect(
      service.sendMessage(actor as never, run.threadId, {
        clientMessageId: "retry-id",
        text: "Try again",
        language: "en",
      }),
    ).resolves.toEqual(expect.objectContaining({ run: expect.objectContaining({ id: "run-2" }) }));
    expect(runtime.start).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["cancelled", "cancelled", undefined],
    ["missing", "failed", "WORKFLOW_NOT_FOUND"],
    ["completed", "failed", "WORKFLOW_COMPLETION_NOT_SAVED"],
  ])(
    "reconciles orphaned %s while retaining saved partial text",
    async (state, status, errorCode) => {
      runtime.getRunState.mockResolvedValue(state);
      await service.recoverPendingRuns();
      expect(run.status).toBe(status);
      if (errorCode) expect(run.errorCode).toBe(errorCode);
      expect(message.text).toBe("Already saved partial response");
    },
  );

  it.each(["pending", "running"])("keeps a live %s workflow active", async (state) => {
    runtime.getRunState.mockResolvedValue(state);
    await service.recoverPendingRuns();
    expect(repository.updateRun).not.toHaveBeenCalled();
    expect(run.status).toBe("running");
  });

  it("defers transient Workflow errors and retries on the following scan", async () => {
    runtime.getRunState.mockRejectedValueOnce(new Error("Workflow database unavailable"));
    await service.recoverPendingRuns();
    expect(repository.updateRun).not.toHaveBeenCalled();
    expect(run.status).toBe("running");
    await service.recoverPendingRuns();
    expect(run.status).toBe("failed");
  });

  it.each(["completed", "cancelled"] as const)(
    "preserves a racing Core %s transition",
    async (status) => {
      runtime.getRunState.mockImplementation(async () => {
        run.status = status;
        message.status = status;
        return "failed";
      });
      await service.recoverPendingRuns();
      expect(run.status).toBe(status);
      expect(message.status).toBe(status);
      expect(message.text).toBe("Already saved partial response");
    },
  );

  it("advances its keyset so older live runs cannot starve later failures", async () => {
    const older = Array.from({ length: 20 }, (_, index) => ({
      ...baseRun,
      id: `older-${index}`,
      workflowRunId: "live-world",
    }));
    repository.boundActiveRuns.mockResolvedValueOnce(older).mockResolvedValueOnce([run]);
    runtime.getRunState.mockImplementation(async (id) =>
      id === "live-world" ? "running" : "failed",
    );
    await service.recoverPendingRuns();
    expect(repository.updateRun).not.toHaveBeenCalled();
    await service.recoverPendingRuns();
    expect(repository.boundActiveRuns.mock.calls[1][1]).toEqual({
      id: "older-19",
      createdAt: baseRun.createdAt,
    });
    expect(run.status).toBe("failed");
    expect(runtime.getRunState).toHaveBeenCalledTimes(21);
  });
});
