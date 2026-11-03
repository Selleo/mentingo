jest.mock("bullmq", () => ({
  Worker: jest.fn().mockImplementation(() => ({ on: jest.fn(), close: jest.fn() })),
}));

import { ForbiddenException } from "@nestjs/common";

import { CourseAuthoringAutonomousWorker } from "./course-authoring-autonomous.worker";

describe("CourseAuthoringAutonomousWorker", () => {
  const job = {
    tenantId: "00000000-0000-4000-8000-000000000001",
    courseId: "00000000-0000-4000-8000-000000000002",
    sessionId: "00000000-0000-4000-8000-000000000003",
    requestId: "00000000-0000-4000-8000-000000000004",
    actorId: "00000000-0000-4000-8000-000000000005",
    eventId: "00000000-0000-4000-8000-000000000006",
    proposalIds: ["00000000-0000-4000-8000-000000000007"],
    controlEpoch: 3,
  };

  function setup() {
    const where = jest.fn().mockResolvedValue([{ id: job.actorId, email: "author@example.test" }]);
    const db = { select: jest.fn(() => ({ from: jest.fn(() => ({ where })) })) };
    const actor = {
      userId: job.actorId,
      tenantId: job.tenantId,
      email: "author@example.test",
      permissions: [],
      roleSlugs: [],
    };
    const context = { authorize: jest.fn().mockResolvedValue(actor) };
    const applications = { enqueue: jest.fn().mockResolvedValue({ status: "queued" }) };
    const worker = new CourseAuthoringAutonomousWorker(
      { getConnection: jest.fn() } as never,
      {} as never,
      applications as never,
      context as never,
      db as never,
    );
    const tenants = { runWithTenant: jest.fn((_id: string, action: () => unknown) => action()) };
    return { worker, tenants, where, context, applications, actor };
  }

  it("reauthorizes the request actor inside the tenant and submits its immutable fence", async () => {
    const test = setup();
    await test.worker.handleJob(job, test.tenants as never);
    expect(test.tenants.runWithTenant).toHaveBeenCalledWith(job.tenantId, expect.any(Function));
    expect(test.context.authorize).toHaveBeenCalledWith(job.courseId, test.actor);
    expect(test.applications.enqueue).toHaveBeenCalledWith(
      job.courseId,
      job.sessionId,
      { commandId: job.eventId, proposalIds: job.proposalIds },
      test.actor,
      { requestId: job.requestId, controlEpoch: job.controlEpoch },
    );
  });

  it("does not prepare an export if the request actor is inactive or has lost access", async () => {
    const missing = setup();
    missing.where.mockResolvedValue([]);
    await expect(missing.worker.handleJob(job, missing.tenants as never)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(missing.applications.enqueue).not.toHaveBeenCalled();

    const revoked = setup();
    revoked.context.authorize.mockRejectedValue(new ForbiddenException());
    await expect(revoked.worker.handleJob(job, revoked.tenants as never)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(revoked.applications.enqueue).not.toHaveBeenCalled();
  });
});
