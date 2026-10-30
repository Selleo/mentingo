import { CourseAuthoringAutonomousFailureService } from "./course-authoring-autonomous-failure.service";

describe("CourseAuthoringAutonomousFailureService", () => {
  const data = {
    tenantId: "tenant-1",
    sessionId: "session-1",
    courseId: "course-1",
    requestId: "request-1",
    actorId: "actor-1",
    eventId: "event-1",
    controlEpoch: 4,
    proposalIds: ["proposal-1"],
  };

  function setup() {
    const job = {
      data: { ...data },
      failedReason: "sensitive-provider-response",
      getState: jest.fn().mockResolvedValue("failed"),
      updateData: jest.fn().mockImplementation(async (value) => {
        job.data = value;
      }),
    };
    const sendCommand = jest.fn().mockResolvedValue({});
    const getJobs = jest.fn().mockResolvedValue([job]);
    const service = new CourseAuthoringAutonomousFailureService(
      { getQueue: jest.fn().mockReturnValue({ getJobs }) } as never,
      {
        runForEachTenant: (callback: (tenantId: string) => Promise<void>) =>
          callback(data.tenantId),
      } as never,
      { getLumaClient: jest.fn().mockResolvedValue({ authoring: { sendCommand } }) } as never,
    );
    return { service, job, sendCommand, getJobs };
  }

  it("reports only the authenticated binding and fixed failure action, without raw error text", async () => {
    const test = setup();
    await test.service.reconcileFailedHandoffs();
    expect(test.getJobs).toHaveBeenCalledWith(["failed"], 0, 99);
    expect(test.sendCommand).toHaveBeenCalledWith({
      sessionId: data.sessionId,
      command: {
        schemaVersion: 1,
        commandId: data.eventId,
        actorId: data.actorId,
        action: "autonomous.fail",
        targetId: data.requestId,
        expectedRevision: data.controlEpoch,
      },
    });
    expect(test.job.updateData).toHaveBeenCalledWith({ ...data, failureReported: true });
    await test.service.reconcileFailedHandoffs();
    expect(test.sendCommand).toHaveBeenCalledTimes(1);
  });

  it("leaves the failed job unreported and retries if the producer is unavailable", async () => {
    const test = setup();
    test.sendCommand.mockRejectedValueOnce(new Error("unavailable"));
    await test.service.reconcileFailedHandoffs();
    expect(test.job.updateData).not.toHaveBeenCalled();
    await test.service.reconcileFailedHandoffs();
    expect(test.sendCommand).toHaveBeenCalledTimes(2);
    expect(test.job.updateData).toHaveBeenCalledWith({ ...data, failureReported: true });
  });

  it("replays the same idempotent command if marking the acknowledged job fails", async () => {
    const test = setup();
    test.job.updateData.mockRejectedValueOnce(new Error("redis unavailable"));
    await test.service.reconcileFailedHandoffs();
    await test.service.reconcileFailedHandoffs();
    expect(test.sendCommand).toHaveBeenCalledTimes(2);
    expect(test.sendCommand.mock.calls[0]).toEqual(test.sendCommand.mock.calls[1]);
  });

  it("uses the retained job marker after a service restart", async () => {
    const test = setup();
    await test.service.reconcileFailedHandoffs();
    const restarted = new CourseAuthoringAutonomousFailureService(
      { getQueue: jest.fn().mockReturnValue({ getJobs: test.getJobs }) } as never,
      {
        runForEachTenant: (callback: (tenantId: string) => Promise<void>) =>
          callback(data.tenantId),
      } as never,
      {
        getLumaClient: jest
          .fn()
          .mockResolvedValue({ authoring: { sendCommand: test.sendCommand } }),
      } as never,
    );
    await restarted.reconcileFailedHandoffs();
    expect(test.sendCommand).toHaveBeenCalledTimes(1);
  });

  it("ignores another tenant's job or a job that is no longer failed", async () => {
    const test = setup();
    test.job.data.tenantId = "tenant-2";
    await test.service.reconcileFailedHandoffs();
    test.job.data.tenantId = data.tenantId;
    test.job.getState.mockResolvedValue("completed");
    await test.service.reconcileFailedHandoffs();
    expect(test.sendCommand).not.toHaveBeenCalled();
  });
});
