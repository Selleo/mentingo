import { PERMISSIONS } from "@repo/shared";
import { Value } from "@sinclair/typebox/value";

import { CompetenciesAssignmentService } from "./competencies-assignment.service";
import {
  competenciesCommandSchema,
  competencyAssignmentBodySchema,
} from "./schemas/competencies.schema";

describe("Competency course assignments", () => {
  function setup() {
    let enrolled = false;
    const identity = {
      userId: "actor",
      tenantId: "tenant",
      email: "manager@example.test",
      roleSlugs: [],
    };
    const permissions = [PERMISSIONS.COMPETENCIES_USE, PERMISSIONS.COURSE_ENROLLMENT];
    const context = {
      userId: "actor",
      canManage: false,
      managedSubjectIds: ["learner"],
      locale: "en",
    };
    const client = {
      configuration: jest
        .fn()
        .mockResolvedValue({ capabilities: { competencies: { enabled: true } } }),
      workspace: jest.fn().mockResolvedValue({
        actions: [
          {
            id: "action",
            subjectId: "learner",
            kind: "course",
            courseId: "course",
            status: "planned",
          },
        ],
      }),
      execute: jest.fn().mockResolvedValue({ id: "action" }),
      failAssignment: jest.fn().mockResolvedValue({ id: "action" }),
    };
    const repository = {
      actorIdentity: jest.fn().mockResolvedValue(identity),
      availableCourses: jest.fn().mockResolvedValue([{ id: "course" }]),
      enrolled: jest.fn(async () => enrolled),
      lockAssignment: jest.fn(),
      people: jest.fn().mockResolvedValue([{ id: "learner", archived: false }]),
    };
    const enrollCourses = jest.fn(async () => {
      enrolled = true;
    });
    const roles = { getPermissionsForRoleSlugs: jest.fn().mockResolvedValue(permissions) };
    const queue = { getJob: jest.fn().mockResolvedValue(undefined) };
    const queueService = { getQueue: jest.fn(() => queue), enqueue: jest.fn() };
    const service = new CompetenciesAssignmentService(
      {
        run: async <T>(operation: (value: typeof client) => Promise<T>) => operation(client),
      } as never,
      { context: jest.fn().mockResolvedValue(context) } as never,
      repository as never,
      queueService as never,
      { enrollCourses } as never,
      roles as never,
      { transaction: async <T>(operation: () => Promise<T>) => operation() } as never,
    );
    return {
      service,
      identity,
      permissions,
      context,
      client,
      repository,
      enrollCourses,
      roles,
      queue,
      queueService,
    };
  }
  it("does not repeat enrollment when the confirmation response is lost", async () => {
    const { service, client, enrollCourses, repository } = setup();
    client.execute.mockRejectedValueOnce(new Error("Lost response"));
    await expect(service.perform("actor", "action", "receipt")).rejects.toThrow("Lost response");
    await service.perform("actor", "action", "receipt");
    expect(enrollCourses).toHaveBeenCalledTimes(1);
    expect(repository.lockAssignment).toHaveBeenCalledTimes(2);
    expect(client.execute).toHaveBeenLastCalledWith(expect.anything(), {
      operation: "assignment_result",
      id: "action",
      subjectId: "learner",
      requestId: "receipt",
      status: "confirmed",
    });
  });
  it("rechecks current role permissions and manager scope before enrollment", async () => {
    const { service, roles, context, enrollCourses } = setup();
    roles.getPermissionsForRoleSlugs.mockResolvedValueOnce([PERMISSIONS.COURSE_ENROLLMENT]);
    await expect(service.perform("actor", "action", "receipt")).rejects.toThrow(
      "missingPermission",
    );
    context.managedSubjectIds = [];
    await expect(service.perform("actor", "action", "receipt")).rejects.toThrow(
      "missingPermission",
    );
    expect(enrollCourses).not.toHaveBeenCalled();
  });
  it("retries an exhausted job with the same receipt instead of losing the request", async () => {
    const { service, identity, permissions, queue, queueService } = setup();
    const job = {
      data: {
        operation: "assignment",
        tenantId: "tenant",
        actorId: "actor",
        actionId: "action",
        subjectId: "learner",
        requestId: "receipt",
      },
      id: "assignment-tenant-receipt-actor",
      opts: {},
      name: "assignment",
      getState: jest.fn().mockResolvedValue("failed"),
      remove: jest.fn(),
    };
    queue.getJob.mockResolvedValueOnce(job);
    await service.request({ ...identity, permissions }, "action", "receipt", "learner");
    expect(job.remove).toHaveBeenCalledTimes(1);
    expect(queueService.enqueue).toHaveBeenCalledWith(
      expect.anything(),
      "assignment",
      job.data,
      expect.objectContaining({ attempts: 8, jobId: "assignment-tenant-receipt-actor" }),
    );
  });

  it("requires a valid assignment subject at the HTTP contract boundary", () => {
    const id = "00000000-0000-4000-8000-000000000001";
    expect(Value.Check(competencyAssignmentBodySchema, { id, requestId: id, subjectId: id })).toBe(
      true,
    );
    expect(Value.Check(competencyAssignmentBodySchema, { id, requestId: id })).toBe(false);
    expect(
      Value.Check(competencyAssignmentBodySchema, { id, requestId: id, subjectId: "foreign" }),
    ).toBe(false);
    expect(
      Value.Check(competenciesCommandSchema, {
        operation: "assignment_result",
        id,
        requestId: id,
        subjectId: id,
        status: "confirmed",
      }),
    ).toBe(false);
  });
  it.each(["archived", "deleted", "unknown", "foreign", "missing"])(
    "does not claim or enqueue an assignment for an %s subject",
    async (state) => {
      const { service, identity, permissions, repository, client, queueService } = setup();
      const people =
        state === "archived"
          ? [{ id: "learner", archived: true }]
          : state === "foreign"
            ? [{ id: "other-tenant-user", archived: false }]
            : [];
      repository.people.mockResolvedValue(people);
      await expect(
        service.request(
          { ...identity, permissions },
          "action",
          "receipt",
          state === "missing" ? "" : "learner",
        ),
      ).rejects.toThrow("invalidSubject");
      expect(client.execute).not.toHaveBeenCalled();
      expect(queueService.enqueue).not.toHaveBeenCalled();
    },
  );
  it("claims and queues an active subject with the subject identity in trusted job data", async () => {
    const { service, identity, permissions, client, queueService } = setup();
    await service.request({ ...identity, permissions }, "action", "receipt", "learner");
    expect(client.execute).toHaveBeenCalledWith(expect.anything(), {
      operation: "assignment_result",
      id: "action",
      requestId: "receipt",
      subjectId: "learner",
      status: "pending",
    });
    expect(queueService.enqueue).toHaveBeenCalledWith(
      expect.anything(),
      "assignment",
      {
        operation: "assignment",
        tenantId: "tenant",
        actorId: "actor",
        actionId: "action",
        requestId: "receipt",
        subjectId: "learner",
      },
      expect.objectContaining({ attempts: 8 }),
    );
  });
  it.each(["archived", "deleted", "foreign", "missing"])(
    "preserves assignment history when a final failure concerns an %s subject",
    async (state) => {
      const { service, repository, client } = setup();
      repository.people.mockResolvedValue(
        state === "archived"
          ? [{ id: "learner", archived: true }]
          : state === "foreign"
            ? [{ id: "other-tenant-user", archived: false }]
            : [],
      );
      await service.failed("action", "receipt", state === "missing" ? "" : "learner");
      expect(client.failAssignment).not.toHaveBeenCalled();
    },
  );
  it("delivers failure receipts for the current active subject", async () => {
    const { service, client } = setup();
    await service.failed("action", "receipt", "learner");
    expect(client.failAssignment).toHaveBeenCalledWith("action", "receipt", "learner");
  });
  it("does not confirm an assignment when its subject is archived during enrollment", async () => {
    const { service, repository, enrollCourses, client } = setup();
    repository.people
      .mockResolvedValueOnce([{ id: "learner", archived: false }])
      .mockResolvedValue([{ id: "learner", archived: true }]);
    await expect(service.perform("actor", "action", "receipt")).rejects.toThrow("invalidSubject");
    expect(enrollCourses).toHaveBeenCalledTimes(1);
    expect(client.execute).not.toHaveBeenCalled();
    await service.failed("action", "receipt", "learner");
    expect(client.failAssignment).not.toHaveBeenCalled();
  });

  it.each([[[{ id: "learner", archived: true }]], [[]]])(
    "refuses a queued enrollment when the subject is no longer active",
    async (people) => {
      const { service, context, repository, enrollCourses, client } = setup();
      context.canManage = true;
      repository.people.mockResolvedValueOnce(people);
      await expect(service.perform("actor", "action", "receipt")).rejects.toThrow("invalidSubject");
      expect(enrollCourses).not.toHaveBeenCalled();
      expect(client.execute).not.toHaveBeenCalled();
    },
  );
});
