import { readFile } from "node:fs/promises";

import { ConfigService } from "@nestjs/config";
import { loadEsm } from "load-esm";

import { AssistantRuntimeService } from "./assistant-runtime.service";

jest.mock("load-esm", () => ({ loadEsm: jest.fn() }));
jest.mock("node:fs/promises", () => ({ readFile: jest.fn() }));

describe("Assistant durable Workflow state observation", () => {
  let service: AssistantRuntimeService;
  const getRun = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AssistantRuntimeService({} as never, new ConfigService());
    jest.spyOn(service, "isAvailable").mockReturnValue(true);
    jest.mocked(loadEsm).mockResolvedValue({ getRun });
  });

  it.each(["pending", "running", "completed", "failed", "cancelled"])(
    "observes persisted %s without waiting for a model result",
    async (status) => {
      getRun.mockReturnValue({ exists: Promise.resolve(true), status: Promise.resolve(status) });
      await expect(service.getRunState("persisted-workflow-id")).resolves.toBe(status);
      expect(getRun).toHaveBeenCalledWith("persisted-workflow-id");
    },
  );

  it("classifies only an explicit SDK not-found result as missing", async () => {
    getRun.mockReturnValue({ exists: Promise.resolve(false) });
    await expect(service.getRunState("missing-workflow-id")).resolves.toBe("missing");
  });

  it("does not convert a transient existence lookup failure into missing", async () => {
    const error = new Error("Workflow database temporarily unavailable");
    getRun.mockReturnValue({ exists: Promise.reject(error) });
    await expect(service.getRunState("live-workflow-id")).rejects.toBe(error);
  });

  it("propagates a status read failure after existence was confirmed", async () => {
    const error = new Error("Workflow connection reset");
    getRun.mockReturnValue({ exists: Promise.resolve(true), status: Promise.reject(error) });
    await expect(service.getRunState("live-workflow-id")).rejects.toBe(error);
  });

  it("never treats an unconfigured runtime as missing execution", async () => {
    jest.spyOn(service, "isAvailable").mockReturnValue(false);
    await expect(service.getRunState("persisted-workflow-id")).rejects.toThrow(
      "assistant.errors.unavailable",
    );
    expect(getRun).not.toHaveBeenCalled();
  });
});

describe("Assistant runtime database configuration", () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousWorkflowUrl = process.env.WORKFLOW_POSTGRES_URL;
  const previousTraceMode = process.env.WORKFLOW_TRACE_MODE;
  const previousBuildVerification = process.env.BUILD_VERIFICATION;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = "production";
    delete process.env.WORKFLOW_POSTGRES_URL;
    delete process.env.BUILD_VERIFICATION;
    delete process.env.WORKFLOW_TRACE_MODE;
  });

  afterEach(() => {
    for (const [key, value] of Object.entries({
      NODE_ENV: previousNodeEnv,
      WORKFLOW_POSTGRES_URL: previousWorkflowUrl,
      WORKFLOW_TRACE_MODE: previousTraceMode,
      BUILD_VERIFICATION: previousBuildVerification,
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it.each([
    { obsoleteUrl: undefined, traceMode: undefined },
    { obsoleteUrl: "postgres://old-workflow-db/ignored", traceMode: "linked" },
  ])(
    "starts with Core app credentials regardless of obsolete URL $obsoleteUrl and honors trace mode $traceMode",
    async ({ obsoleteUrl, traceMode }) => {
      if (obsoleteUrl) process.env.WORKFLOW_POSTGRES_URL = obsoleteUrl;
      if (traceMode) process.env.WORKFLOW_TRACE_MODE = traceMode;
      const connectionString = "postgres://core-app@localhost/core";
      const world = { registerHandler: jest.fn(), start: jest.fn(), close: jest.fn() };
      const createWorld = jest.fn(() => world);
      const setWorld = jest.fn();
      jest.mocked(readFile).mockResolvedValue(
        JSON.stringify({
          workflows: { assistant: { assistantWorkflow: { workflowId: "fixture" } } },
        }),
      );
      jest
        .mocked(loadEsm)
        .mockResolvedValueOnce({ createWorld })
        .mockResolvedValueOnce({ setWorld })
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({ POST: jest.fn() });
      const service = new AssistantRuntimeService(
        {} as never,
        new ConfigService({ database: { urlApp: connectionString, urlAdmin: "unused-admin" } }),
      );
      await service.onApplicationBootstrap();
      expect(createWorld).toHaveBeenCalledWith(expect.objectContaining({ connectionString }));
      expect(setWorld).toHaveBeenCalledWith(world);
      expect(world.registerHandler).toHaveBeenCalledWith("__wkf_workflow_", expect.any(Function));
      expect(world.start).toHaveBeenCalledTimes(1);
      expect(service.isAvailable()).toBe(true);
      expect(process.env.WORKFLOW_TRACE_MODE).toBe(traceMode ?? "continuous");
      await service.onApplicationShutdown();
    },
  );

  it("skips runtime side effects during the existing CI build verification mode", async () => {
    process.env.BUILD_VERIFICATION = "true";
    const service = new AssistantRuntimeService({} as never, new ConfigService());
    await service.onApplicationBootstrap();
    expect(service.isAvailable()).toBe(false);
    expect(loadEsm).not.toHaveBeenCalled();
  });

  it("fails explicitly when the existing Core app connection is missing", async () => {
    const service = new AssistantRuntimeService({} as never, new ConfigService());
    await expect(service.onApplicationBootstrap()).rejects.toThrow("database.urlApp");
    expect(loadEsm).not.toHaveBeenCalled();
  });
});
