import { loadEsm } from "load-esm";

import { AssistantRuntimeService } from "./assistant-runtime.service";

jest.mock("load-esm", () => ({ loadEsm: jest.fn() }));

describe("Assistant durable Workflow state observation", () => {
  let service: AssistantRuntimeService;
  const getRun = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AssistantRuntimeService({} as never);
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
    await expect(service.getRunState("persisted-workflow-id")).rejects.toThrow("not configured");
    expect(getRun).not.toHaveBeenCalled();
  });
});
