import { ForbiddenException } from "@nestjs/common";
import {
  ASSISTANT_RUN_ACTIVITIES,
  ASSISTANT_RUN_STATUSES,
  ASSISTANT_RUN_ERROR_CODES,
  ASSISTANT_OUTCOME_KINDS,
  ASSISTANT_OUTCOME_VALIDATION_CODES,
  TENANT_STATUSES,
} from "@repo/shared";

import { AssistantExecutionService } from "./assistant-execution.service";

import type { AssistantRepository } from "./assistant.repository";
import type { AiRuntimeService } from "src/ai/services/ai-runtime.service";
import type { McpHttpService } from "src/mcp/mcp-http.service";
import type { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

describe("AssistantExecutionService", () => {
  const identity = { tenantId: "tenant-1", runId: "run-1" };
  const run = {
    id: "run-1",
    tenantId: "tenant-1",
    threadId: "thread-1",
    userId: "user-1",
    status: ASSISTANT_RUN_STATUSES.RUNNING,
    successfulToolCalls: 1,
    readableToolCalls: 1,
    origin: "https://tenant.example",
    sources: [{ title: "Verified", url: "https://tenant.example/course/real" }],
  };
  let assistantRepository: {
    getRun: jest.Mock;
    updateRun: jest.Mock;
    getHistory: jest.Mock;
    findTenantState: jest.Mock;
    isAccountActive: jest.Mock;
  };
  let activeAccount: jest.Mock;
  let currentTenant: { status: string } | undefined;
  let modelProvider: jest.Mock;
  let mcpHttpService: { executeNativeReadTool: jest.Mock; listNativeReadTools: jest.Mock };
  let service: AssistantExecutionService;
  let tenantDbRunnerService: { runWithTenant: jest.Mock };

  const capabilities = {
    articles: { enabled: false, canList: false, canRead: false },
    news: { enabled: true, canList: true, canRead: true },
    qa: { enabled: true, canList: true, canRead: true },
    developmentPaths: { enabled: true, canList: true, canRead: true },
  };

  beforeEach(() => {
    assistantRepository = {
      getRun: jest.fn().mockResolvedValue({ ...run }),
      updateRun: jest.fn().mockResolvedValue(run),
      getHistory: jest.fn().mockResolvedValue([]),
      findTenantState: jest.fn(async () => currentTenant),
      isAccountActive: jest.fn(async () => activeAccount()),
    };
    activeAccount = jest.fn().mockResolvedValue(true);
    currentTenant = { status: TENANT_STATUSES.ACTIVE };
    modelProvider = jest.fn(async () => () => ({ fixture: true }));
    mcpHttpService = {
      executeNativeReadTool: jest
        .fn()
        .mockImplementation(async (_userId, _tenantId, _origin, name) => ({
          structuredContent:
            name === "get_my_capabilities" ? { features: capabilities } : { items: run.sources },
        })),
      listNativeReadTools: jest.fn().mockResolvedValue([]),
    };
    tenantDbRunnerService = { runWithTenant: jest.fn((_tenantId, callback) => callback()) };
    service = new AssistantExecutionService(
      assistantRepository as unknown as AssistantRepository,
      mcpHttpService as unknown as McpHttpService,
      tenantDbRunnerService as unknown as TenantDbRunnerService,
      { getAISdkOpenAI: modelProvider } as unknown as AiRuntimeService,
    );
  });

  const operations = [
    "loadContext",
    "getModel",
    "executeTool",
    "checkpoint",
    "complete",
    "validateOutcome",
    "setActivity",
  ] satisfies (keyof AssistantExecutionService)[];
  const invoke = (operation: (typeof operations)[number]) => {
    if (operation === "executeTool") return service.executeTool(identity, "global_search", {});
    if (operation === "checkpoint") return service.checkpoint(identity, "Must not persist");
    if (operation === "complete") return service.complete(identity, "Must not persist");
    if (operation === "validateOutcome")
      return service.validateOutcome(identity, {
        kind: ASSISTANT_OUTCOME_KINDS.CONVERSATION,
        text: "Hello",
        requiresReadableContent: false,
      });
    if (operation === "setActivity")
      return service.setActivity(identity, ASSISTANT_RUN_ACTIVITIES.THINKING);
    return service[operation](identity);
  };

  describe.each([ASSISTANT_RUN_STATUSES.PENDING, ASSISTANT_RUN_STATUSES.RUNNING])(
    "tenant suspension during a %s run",
    (status) => {
      it.each(operations)(
        "blocks %s after active tenant becomes inactive, allowing only a terminal status write",
        async (operation) => {
          assistantRepository.getRun.mockResolvedValue({ ...run, status });
          // The run was authorized while queued/running; the current DB tenant row then changes.
          await expect(
            service.validateOutcome(identity, {
              kind: ASSISTANT_OUTCOME_KINDS.CONVERSATION,
              text: "Hello",
              requiresReadableContent: false,
            }),
          ).resolves.toEqual(expect.objectContaining({ accepted: true }));
          currentTenant = { status: TENANT_STATUSES.INACTIVE };
          await expect(invoke(operation)).rejects.toBeInstanceOf(ForbiddenException);
          expect(modelProvider).not.toHaveBeenCalled();
          expect(mcpHttpService.executeNativeReadTool).not.toHaveBeenCalled();
          expect(mcpHttpService.listNativeReadTools).not.toHaveBeenCalled();
          expect(assistantRepository.getHistory).not.toHaveBeenCalled();
          expect(assistantRepository.updateRun).toHaveBeenCalledTimes(1);
          expect(assistantRepository.updateRun).toHaveBeenCalledWith(identity, {
            status: ASSISTANT_RUN_STATUSES.FAILED,
            errorCode: ASSISTANT_RUN_ERROR_CODES.TENANT_INACTIVE,
          });
          expect(tenantDbRunnerService.runWithTenant).toHaveBeenCalledWith(
            identity.tenantId,
            expect.any(Function),
          );
        },
      );
    },
  );

  it("checks capabilities before history/catalog without treating them as factual content evidence", async () => {
    const context = await service.loadContext(identity);
    expect(context.capabilities).toEqual(capabilities);
    expect(mcpHttpService.executeNativeReadTool).toHaveBeenCalledWith(
      run.userId,
      identity.tenantId,
      run.origin,
      "get_my_capabilities",
      {},
    );
    expect(mcpHttpService.executeNativeReadTool.mock.invocationCallOrder[0]).toBeLessThan(
      assistantRepository.getHistory.mock.invocationCallOrder[0],
    );
    expect(assistantRepository.updateRun.mock.calls.every(([, patch]) => !patch.recordTool)).toBe(
      true,
    );
  });

  it.each([
    { isError: true },
    { structuredContent: {} },
    { structuredContent: { features: { articles: { enabled: false } } } },
  ])("does not generate without a usable current capability snapshot (%j)", async (result) => {
    mcpHttpService.executeNativeReadTool.mockResolvedValue(result);
    await expect(service.loadContext(identity)).rejects.toThrow("assistant.errors.unavailable");
    expect(assistantRepository.getHistory).not.toHaveBeenCalled();
    expect(modelProvider).not.toHaveBeenCalled();
  });

  it("loads authorized context normally while the tenant remains active", async () => {
    await expect(service.loadContext(identity)).resolves.toMatchObject({
      run,
      messages: [],
      tools: [],
      capabilities,
    });
    expect(mcpHttpService.listNativeReadTools).toHaveBeenCalledWith(
      run.userId,
      identity.tenantId,
      run.origin,
    );
    expect(assistantRepository.getHistory).toHaveBeenCalledWith(identity);
    expect(assistantRepository.updateRun).toHaveBeenCalledWith(identity, {
      status: ASSISTANT_RUN_STATUSES.RUNNING,
    });
    expect(modelProvider).not.toHaveBeenCalled();
  });

  it("fails closed when the tenant row is absent", async () => {
    currentTenant = undefined;
    await expect(service.getModel(identity)).rejects.toBeInstanceOf(ForbiddenException);
    expect(modelProvider).not.toHaveBeenCalled();
    expect(assistantRepository.updateRun).toHaveBeenCalledWith(identity, {
      status: ASSISTANT_RUN_STATUSES.FAILED,
      errorCode: ASSISTANT_RUN_ERROR_CODES.TENANT_NOT_FOUND,
    });
  });

  it("does not resume a suspended run when its tenant is reactivated", async () => {
    currentTenant = { status: TENANT_STATUSES.INACTIVE };
    await expect(service.getModel(identity)).rejects.toBeInstanceOf(ForbiddenException);
    assistantRepository.getRun.mockResolvedValue({
      ...run,
      status: ASSISTANT_RUN_STATUSES.FAILED,
      errorCode: ASSISTANT_RUN_ERROR_CODES.TENANT_INACTIVE,
    });
    currentTenant = { status: TENANT_STATUSES.ACTIVE };
    await expect(service.getModel(identity)).rejects.toBeInstanceOf(ForbiddenException);
    expect(modelProvider).not.toHaveBeenCalled();
    expect(assistantRepository.updateRun).toHaveBeenCalledTimes(1);
  });

  it("persists registered product guidance sources without establishing readable tenant content", async () => {
    const source = {
      title: "Add a lesson",
      description: "Use the course editor.",
      url: `${run.origin}/helpdesk/tutorials/course-authoring.edit?chapter=add-lesson`,
      entityType: "helpdesk",
    };
    assistantRepository.getRun.mockResolvedValue({
      ...run,
      sources: [],
      successfulToolCalls: 0,
      readableToolCalls: 0,
    });
    mcpHttpService.executeNativeReadTool.mockResolvedValue({
      structuredContent: {
        guidanceKind: "product_guidance",
        tutorial: {
          ...source,
          guidanceKind: "product_guidance",
          tutorialKey: "course-authoring.edit",
          chapterId: "add-lesson",
        },
      },
    });
    await service.executeTool(identity, "get_helpdesk_tutorial", {
      key: "course-authoring.edit",
      language: "en",
    });
    expect(assistantRepository.updateRun).toHaveBeenCalledWith(identity, {
      sources: [source],
      recordTool: { readable: false },
    });
    assistantRepository.getRun.mockResolvedValue({
      ...run,
      sources: [source],
      successfulToolCalls: 1,
      readableToolCalls: 0,
    });
    await expect(
      service.validateOutcome(identity, {
        kind: ASSISTANT_OUTCOME_KINDS.ANSWER,
        text: "Use the course editor.",
        requiresReadableContent: false,
      }),
    ).resolves.toEqual(expect.objectContaining({ accepted: true }));
    await expect(
      service.validateOutcome(identity, {
        kind: ASSISTANT_OUTCOME_KINDS.ANSWER,
        text: "This tenant's lesson contains...",
        requiresReadableContent: true,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        accepted: false,
        code: ASSISTANT_OUTCOME_VALIDATION_CODES.NO_READABLE_EVIDENCE,
      }),
    );
  });

  it("rechecks an active account before every tool call and denies a removed account", async () => {
    await service.executeTool(identity, "global_search", {});
    activeAccount.mockResolvedValue(false);
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
    assistantRepository.getRun.mockResolvedValue({
      ...run,
      status: ASSISTANT_RUN_STATUSES.CANCELLED,
    });
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
      status: ASSISTANT_RUN_STATUSES.COMPLETED,
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
      kind: ASSISTANT_OUTCOME_KINDS.ANSWER,
      text: "Invented course fact",
      requiresReadableContent: false,
    };
    await expect(service.validateOutcome(identity, outcome)).resolves.toEqual(
      expect.objectContaining({
        accepted: false,
        code: ASSISTANT_OUTCOME_VALIDATION_CODES.NO_VERIFIED_EVIDENCE,
        feedback: expect.stringContaining("kind=conversation"),
      }),
    );
    await service.checkpoint(identity, outcome.text, [], outcome.kind);
    await expect(service.complete(identity, outcome.text, [], outcome.kind)).resolves.toEqual(
      expect.objectContaining({
        accepted: false,
        code: ASSISTANT_OUTCOME_VALIDATION_CODES.NO_VERIFIED_EVIDENCE,
      }),
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
      service.complete(identity, "Hej! Jak mogę pomóc?", [], ASSISTANT_OUTCOME_KINDS.CONVERSATION),
    ).resolves.toEqual(expect.objectContaining({ accepted: true }));
    expect(assistantRepository.updateRun).toHaveBeenLastCalledWith(identity, {
      status: ASSISTANT_RUN_STATUSES.COMPLETED,
      text: "Hej! Jak mogę pomóc?",
      messageSources: [],
    });
  });

  it("returns repair feedback for a summary when retrieval returned only metadata", async () => {
    assistantRepository.getRun.mockResolvedValue({ ...run, readableToolCalls: 0 });
    await expect(
      service.complete(
        identity,
        "Invented lesson summary",
        [],
        ASSISTANT_OUTCOME_KINDS.ANSWER,
        true,
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        accepted: false,
        code: ASSISTANT_OUTCOME_VALIDATION_CODES.NO_READABLE_EVIDENCE,
      }),
    );
    await service.checkpoint(
      identity,
      "Invented lesson summary",
      [],
      ASSISTANT_OUTCOME_KINDS.ANSWER,
      true,
    );
    expect(assistantRepository.updateRun).not.toHaveBeenCalled();
  });

  it("rechecks actor access when validating an outcome", async () => {
    activeAccount.mockResolvedValue(false);
    await expect(
      service.validateOutcome(identity, {
        kind: ASSISTANT_OUTCOME_KINDS.CONVERSATION,
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

  it.each([
    ASSISTANT_RUN_STATUSES.COMPLETED,
    ASSISTANT_RUN_STATUSES.FAILED,
    ASSISTANT_RUN_STATUSES.CANCELLED,
  ])("rejects a late activity update for %s", async (status) => {
    assistantRepository.getRun.mockResolvedValue({ ...run, status });
    await expect(
      service.setActivity(identity, ASSISTANT_RUN_ACTIVITIES.WRITING),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(assistantRepository.updateRun).not.toHaveBeenCalled();
  });
});
