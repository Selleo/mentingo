import { ForbiddenException } from "@nestjs/common";
import { ASSISTANT_RUN_ACTIVITIES } from "@repo/shared";

import { AssistantExecutionService } from "./assistant-execution.service";

import type { AssistantRepository } from "./assistant.repository";
import type { AiRuntimeService } from "src/ai/services/ai-runtime.service";
import type { DatabasePg } from "src/common";
import type { McpHttpService } from "src/mcp/mcp-http.service";
import type { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

describe("AssistantExecutionService", () => {
  const identity = { tenantId: "tenant-1", runId: "run-1" };
  const run = {
    id: "run-1",
    tenantId: "tenant-1",
    threadId: "thread-1",
    userId: "user-1",
    status: "running",
    successfulToolCalls: 1,
    readableToolCalls: 1,
    origin: "https://tenant.example",
    sources: [{ title: "Verified", url: "https://tenant.example/course/real" }],
  };
  let assistantRepository: { getRun: jest.Mock; updateRun: jest.Mock; getHistory: jest.Mock };
  let activeAccount: jest.Mock;
  let mcpHttpService: { executeNativeReadTool: jest.Mock; listNativeReadTools: jest.Mock };
  let service: AssistantExecutionService;
  let tenantDbRunnerService: { runWithTenant: jest.Mock };

  beforeEach(() => {
    assistantRepository = {
      getRun: jest.fn().mockResolvedValue({ ...run }),
      updateRun: jest.fn().mockResolvedValue(run),
      getHistory: jest.fn().mockResolvedValue([]),
    };
    activeAccount = jest.fn().mockResolvedValue([{ id: "user-1" }]);
    mcpHttpService = {
      executeNativeReadTool: jest
        .fn()
        .mockResolvedValue({ structuredContent: { items: run.sources } }),
      listNativeReadTools: jest.fn().mockResolvedValue([]),
    };
    tenantDbRunnerService = { runWithTenant: jest.fn((_tenantId, callback) => callback()) };
    const query = {
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      limit: activeAccount,
    };
    service = new AssistantExecutionService(
      assistantRepository as unknown as AssistantRepository,
      mcpHttpService as unknown as McpHttpService,
      tenantDbRunnerService as unknown as TenantDbRunnerService,
      {} as AiRuntimeService,
      { select: jest.fn(() => query) } as unknown as DatabasePg,
    );
  });

  it("rechecks an active account before every tool call and denies a removed account", async () => {
    await service.executeTool(identity, "global_search", {});
    activeAccount.mockResolvedValue([]);
    await expect(service.executeTool(identity, "global_search", {})).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(mcpHttpService.executeNativeReadTool).toHaveBeenCalledTimes(1);
    expect(tenantDbRunnerService.runWithTenant).toHaveBeenCalledWith(
      identity.tenantId,
      expect.any(Function),
    );
  });

  it("refuses late checkpoints after cancellation", async () => {
    assistantRepository.getRun.mockResolvedValue({ ...run, status: "cancelled" });
    await expect(service.checkpoint(identity, "late text")).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(assistantRepository.updateRun).not.toHaveBeenCalled();
  });

  it("ignores model source claims and preserves the durable tool source registry", async () => {
    await service.complete(
      identity,
      "[real](https://tenant.example/course/real) [fake](https://tenant.example/course/fake)",
      [{ title: "Fake", url: "https://tenant.example/course/fake" }],
    );
    expect(assistantRepository.updateRun).toHaveBeenCalledWith(identity, {
      status: "completed",
      text: "[real](https://tenant.example/course/real) fake",
      messageSources: run.sources,
    });
  });
  it("returns repair feedback without persisting unsupported factual output", async () => {
    assistantRepository.getRun.mockResolvedValue({
      ...run,
      successfulToolCalls: 0,
      readableToolCalls: 0,
      sources: [],
    });
    const outcome = {
      kind: "answer" as const,
      text: "Invented course fact",
      requiresReadableContent: false,
    };
    await expect(service.validateOutcome(identity, outcome)).resolves.toEqual(
      expect.objectContaining({
        accepted: false,
        code: "NO_VERIFIED_EVIDENCE",
        feedback: expect.stringContaining("kind=conversation"),
      }),
    );
    await service.checkpoint(identity, outcome.text, [], outcome.kind);
    await expect(service.complete(identity, outcome.text, [], outcome.kind)).resolves.toEqual(
      expect.objectContaining({ accepted: false, code: "NO_VERIFIED_EVIDENCE" }),
    );
    expect(assistantRepository.updateRun).not.toHaveBeenCalled();
  });

  it("allows a conversation to complete with zero authoritative reads", async () => {
    assistantRepository.getRun.mockResolvedValue({
      ...run,
      successfulToolCalls: 0,
      readableToolCalls: 0,
      sources: [],
    });
    await expect(
      service.complete(identity, "Hej! Jak mogę pomóc?", [], "conversation"),
    ).resolves.toEqual(expect.objectContaining({ accepted: true }));
    expect(assistantRepository.updateRun).toHaveBeenLastCalledWith(identity, {
      status: "completed",
      text: "Hej! Jak mogę pomóc?",
      messageSources: [],
    });
  });

  it("returns repair feedback for a summary when retrieval returned only metadata", async () => {
    assistantRepository.getRun.mockResolvedValue({ ...run, readableToolCalls: 0 });
    await expect(
      service.complete(identity, "Invented lesson summary", [], "answer", true),
    ).resolves.toEqual(expect.objectContaining({ accepted: false, code: "NO_READABLE_EVIDENCE" }));
    await service.checkpoint(identity, "Invented lesson summary", [], "answer", true);
    expect(assistantRepository.updateRun).not.toHaveBeenCalled();
  });

  it("rechecks actor access when validating an outcome", async () => {
    activeAccount.mockResolvedValue([]);
    await expect(
      service.validateOutcome(identity, {
        kind: "conversation",
        text: "Hello",
        requiresReadableContent: false,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(assistantRepository.updateRun).not.toHaveBeenCalled();
  });
  it("sets thinking before resolving a model for the actual model step", async () => {
    const model = { fixture: true };
    const getAISdkOpenAI = jest.fn(async () => {
      expect(assistantRepository.updateRun).toHaveBeenCalledWith(identity, {
        activity: ASSISTANT_RUN_ACTIVITIES.THINKING,
      });
      return () => model;
    });
    Object.assign(service, { aiRuntimeService: { getAISdkOpenAI } });
    await expect(service.getModel(identity)).resolves.toBe(model);
  });

  it("persists search progress only when an authorized read is actually running", async () => {
    let authorizeStarted: () => void = () => undefined;
    let finishRead: (value: unknown) => void = () => undefined;
    const started = new Promise<void>((resolve) => {
      authorizeStarted = resolve;
    });
    const read = new Promise((resolve) => {
      finishRead = resolve;
    });
    mcpHttpService.executeNativeReadTool.mockImplementation(
      async (_userId, _tenantId, _origin, _name, _args, onAuthorized) => {
        expect(assistantRepository.updateRun).not.toHaveBeenCalled();
        await onAuthorized();
        authorizeStarted();
        return read;
      },
    );
    const pending = service.executeTool(identity, "global_search", {});
    await started;
    expect(assistantRepository.updateRun).toHaveBeenCalledWith(identity, {
      activity: ASSISTANT_RUN_ACTIVITIES.SEARCHING,
    });
    finishRead({ structuredContent: { items: [] } });
    await pending;
  });

  it.each(["completed", "failed", "cancelled"])(
    "rejects a late activity update for %s",
    async (status) => {
      assistantRepository.getRun.mockResolvedValue({ ...run, status });
      await expect(
        service.setActivity(identity, ASSISTANT_RUN_ACTIVITIES.WRITING),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(assistantRepository.updateRun).not.toHaveBeenCalled();
    },
  );
});
