import { COMPETENCIES_MAX_SCOPE_SUBJECTS } from "@mentingo/competencies-sdk";

import { QUEUE_NAMES } from "src/queue";

import { CompetenciesSyncService } from "./competencies-sync.service";

describe("Competency synchronization", () => {
  function setup() {
    const client = {
      isConfigured: jest.fn().mockResolvedValue(true),
      configuration: jest
        .fn()
        .mockResolvedValue({ capabilities: { competencies: { enabled: true } } }),
      factScopes: jest.fn().mockResolvedValue({ pairs: [], nextCursor: null }),
      reconcileFacts: jest.fn(),
    };
    const repository = {
      sourcePairs: jest.fn().mockResolvedValue([{ subjectId: "learner", courseId: "course" }]),
      snapshot: jest.fn(async (subjectId, courseId) => ({
        subjectId,
        courseId,
        revision: 1,
        facts: [],
      })),
    };
    const job = {
      id: "sync-tenant-learner-course",
      data: { operation: "sync", tenantId: "tenant", subjectId: "learner", courseId: "course" },
      opts: {},
      name: "sync",
      getState: jest.fn().mockResolvedValue("failed"),
      remove: jest.fn(),
    };
    const queueService = {
      getQueue: jest.fn(() => ({ getJob: jest.fn().mockResolvedValue(job) })),
      enqueue: jest.fn(),
    };
    const competenciesClientService = {
      isConfigured: jest.fn().mockResolvedValue(true),
      requestWithClient: async <T>(operation: (value: typeof client) => Promise<T>) =>
        operation(client),
    };
    const service = new CompetenciesSyncService(
      repository as never,
      competenciesClientService as never,
      queueService as never,
      {
        runWithTenant: async (_tenantId: string, operation: () => Promise<void>) => operation(),
      } as never,
    );
    return { service, client, repository, queueService, job, competenciesClientService };
  }

  it("refreshes only requested subjects and includes removed sources known to the plugin", async () => {
    const { service, client, repository, queueService } = setup();
    client.factScopes
      .mockResolvedValueOnce({
        pairs: [
          { subjectId: "learner", courseId: "removed" },
          { subjectId: "other", courseId: "private" },
        ],
        nextCursor: "page-2",
      })
      .mockResolvedValueOnce({
        pairs: [{ subjectId: "learner", courseId: "course" }],
        nextCursor: null,
      });

    await service.reconcileSubjectLearningFacts(["learner"]);

    expect(repository.sourcePairs).toHaveBeenCalledWith(["learner"]);
    expect(client.factScopes.mock.calls).toEqual([
      [undefined, ["learner"]],
      ["page-2", ["learner"]],
    ]);
    expect(repository.snapshot.mock.calls).toEqual([
      ["learner", "removed"],
      ["learner", "course"],
    ]);
    expect(client.reconcileFacts).toHaveBeenCalledTimes(2);
    expect(queueService.enqueue).not.toHaveBeenCalled();
  });

  it("does not reconcile after a later page fails", async () => {
    const { service, client, repository } = setup();
    client.factScopes
      .mockResolvedValueOnce({
        pairs: [{ subjectId: "learner", courseId: "removed" }],
        nextCursor: "page-2",
      })
      .mockRejectedValueOnce(new Error("Offline"));

    await expect(service.reconcileSubjectLearningFacts(["learner"])).rejects.toThrow("Offline");
    expect(repository.snapshot).not.toHaveBeenCalled();
    expect(client.reconcileFacts).not.toHaveBeenCalled();
  });

  it("rejects a repeated cursor before reconciling any snapshots", async () => {
    const { service, client, repository } = setup();
    client.factScopes.mockResolvedValue({ pairs: [], nextCursor: "page-2" });

    await expect(service.reconcileSubjectLearningFacts(["learner"])).rejects.toThrow(
      "Repeated learning scope cursor",
    );
    expect(repository.snapshot).not.toHaveBeenCalled();
    expect(client.reconcileFacts).not.toHaveBeenCalled();
  });

  it("scopes and batches every plugin page before reconciling", async () => {
    const { service, client, repository } = setup();
    const subjects = Array.from(
      { length: COMPETENCIES_MAX_SCOPE_SUBJECTS * 2 + 1 },
      (_, index) => `subject-${index}`,
    );
    repository.sourcePairs.mockResolvedValue([]);
    client.factScopes.mockImplementation(async (_cursor, batch) => ({
      pairs: [
        { subjectId: batch[0], courseId: "course" },
        { subjectId: "unrelated", courseId: "other" },
      ],
      nextCursor: null,
    }));

    await service.reconcileSubjectLearningFacts(subjects);

    expect(client.factScopes.mock.calls.map((call) => call[1])).toEqual([
      subjects.slice(0, COMPETENCIES_MAX_SCOPE_SUBJECTS),
      subjects.slice(COMPETENCIES_MAX_SCOPE_SUBJECTS, COMPETENCIES_MAX_SCOPE_SUBJECTS * 2),
      subjects.slice(COMPETENCIES_MAX_SCOPE_SUBJECTS * 2),
    ]);
    expect(repository.snapshot.mock.calls.map(([subjectId]) => subjectId)).toEqual([
      subjects[0],
      subjects[COMPETENCIES_MAX_SCOPE_SUBJECTS],
      subjects[COMPETENCIES_MAX_SCOPE_SUBJECTS * 2],
    ]);
    expect(
      client.factScopes.mock.invocationCallOrder.every(
        (call) => call < Math.min(...repository.snapshot.mock.invocationCallOrder),
      ),
    ).toBe(true);
  });

  it("does not reconcile after a later subject batch fails", async () => {
    const { service, client, repository } = setup();
    const subjects = Array.from(
      { length: COMPETENCIES_MAX_SCOPE_SUBJECTS + 1 },
      (_, index) => `subject-${index}`,
    );
    client.factScopes
      .mockResolvedValueOnce({
        pairs: [{ subjectId: subjects[0], courseId: "removed" }],
        nextCursor: null,
      })
      .mockRejectedValueOnce(new Error("Second batch unavailable"));

    await expect(service.reconcileSubjectLearningFacts(subjects)).rejects.toThrow(
      "Second batch unavailable",
    );
    expect(repository.snapshot).not.toHaveBeenCalled();
    expect(client.reconcileFacts).not.toHaveBeenCalled();
  });

  it("does no source or plugin work without authorized subjects", async () => {
    const { service, client, repository } = setup();
    await service.reconcileSubjectLearningFacts([]);
    expect(client.factScopes).not.toHaveBeenCalled();
    expect(repository.sourcePairs).not.toHaveBeenCalled();
  });

  it("bounds parallel delivery when a team requests current results", async () => {
    const { service, client, repository } = setup();
    repository.sourcePairs.mockResolvedValue(
      Array.from({ length: 25 }, (_, index) => ({
        subjectId: "learner",
        courseId: `course-${index}`,
      })),
    );
    let running = 0;
    let maximum = 0;
    client.reconcileFacts.mockImplementation(async () => {
      maximum = Math.max(maximum, ++running);
      await new Promise((resolve) => setImmediate(resolve));
      running--;
    });

    await service.reconcileSubjectLearningFacts(["learner"]);

    expect(maximum).toBeLessThanOrEqual(8);
    expect(client.reconcileFacts).toHaveBeenCalledTimes(25);
  });

  it("recovers an exhausted sync job when the affected source changes again", async () => {
    const { service, job, queueService } = setup();
    await service.enqueueCourseLearningFacts("tenant", "learner", "course");
    expect(job.remove).toHaveBeenCalledTimes(1);
    expect(queueService.enqueue).toHaveBeenCalledWith(
      QUEUE_NAMES.COMPETENCIES,
      "sync",
      job.data,
      expect.objectContaining({ attempts: 8, jobId: "sync-tenant-learner-course" }),
    );
  });

  it("does not enqueue work when the tenant has no competency integration configured", async () => {
    const { service, queueService, competenciesClientService } = setup();
    // The integration is intentionally optional for tenants that have not configured it.
    competenciesClientService.isConfigured.mockResolvedValue(false);
    await service.enqueueCourseLearningFacts("tenant", "learner", "course");
    expect(queueService.enqueue).not.toHaveBeenCalled();
  });

  it("queries only the affected subject after a certificate event", async () => {
    const { service, repository } = setup();
    await service.enqueueSubjectLearningFacts("tenant", "learner");
    expect(repository.sourcePairs).toHaveBeenCalledWith(["learner"]);
  });
  it("keeps a later source event queued independently of an in-flight snapshot", async () => {
    const { service, queueService } = setup();
    jest
      .spyOn(queueService, "getQueue")
      .mockReturnValue({ getJob: jest.fn().mockResolvedValue(undefined) });
    await service.enqueueCourseLearningFacts("tenant", "learner", "course", "event-1");
    await service.enqueueCourseLearningFacts("tenant", "learner", "course", "event-2");
    expect(queueService.enqueue.mock.calls.map((call) => call[3].jobId)).toEqual([
      "sync-tenant-learner-course-event-1",
      "sync-tenant-learner-course-event-2",
    ]);
  });
});
