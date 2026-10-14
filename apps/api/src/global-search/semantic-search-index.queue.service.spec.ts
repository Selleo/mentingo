import { SemanticSearchIndexQueueService } from "./semantic-search-index.queue.service";

describe("file source reconciliation", () => {
  function setup() {
    const source = {
      entityType: "articles",
      entityId: "article",
      documentType: "resource:file",
      language: "en",
      sourceHash: "hash",
      sourceRevision: "revision",
    };
    const repository = {
      synchronizeResourceDocuments: jest.fn().mockResolvedValue(undefined),
      findPending: jest.fn().mockResolvedValue([source]),
      previewPendingCount: jest.fn().mockResolvedValue(1),
      cleanupDeleted: jest.fn().mockResolvedValue(undefined),
    };
    const jobs = {
      getJobCounts: jest.fn().mockResolvedValue({ waiting: 0, active: 0, delayed: 0 }),
      getJob: jest.fn().mockResolvedValue(undefined),
    };
    const queue = { getQueue: jest.fn().mockReturnValue(jobs), enqueue: jest.fn() };
    const service = new SemanticSearchIndexQueueService(repository as never, queue as never);
    return { repository, queue, service };
  }

  it("discovers canonical files before reading and enqueueing pending sources", async () => {
    const { repository, queue, service } = setup();
    const result = await service.reconcile("tenant");
    expect(repository.synchronizeResourceDocuments).toHaveBeenCalledTimes(1);
    expect(repository.synchronizeResourceDocuments.mock.invocationCallOrder[0]).toBeLessThan(
      repository.findPending.mock.invocationCallOrder[0],
    );
    expect(result).toEqual({ pending: 1, enqueued: 1 });
    expect(queue.enqueue).toHaveBeenCalledWith(
      "semantic-search-index",
      "index-source",
      expect.objectContaining({
        tenantId: "tenant",
        entityType: "articles",
        documentType: "resource:file",
      }),
      expect.any(Object),
    );
  });

  it("keeps dry-run backfills read-only and does not enqueue extraction", async () => {
    const { repository, queue, service } = setup();
    expect(await service.reconcile("tenant", { dryRun: true })).toEqual({
      pending: 1,
      enqueued: 0,
    });
    expect(repository.synchronizeResourceDocuments).not.toHaveBeenCalled();
    expect(repository.cleanupDeleted).not.toHaveBeenCalled();
    expect(repository.findPending).not.toHaveBeenCalled();
    expect(repository.previewPendingCount).toHaveBeenCalledWith(50, 0);
    expect(queue.getQueue).not.toHaveBeenCalled();
    expect(queue.enqueue).not.toHaveBeenCalled();
  });
});
