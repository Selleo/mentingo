jest.mock("bullmq", () => ({ Worker: jest.fn() }));

import { Worker } from "bullmq";

import { isSemanticSearchBackgroundIndexingEnabled } from "./semantic-search-index.config";
import { SemanticSearchIndexCron } from "./semantic-search-index.cron";
import { SemanticSearchIndexWorker } from "./semantic-search-index.worker";

describe("semantic search background indexing switch", () => {
  const original = process.env.SEMANTIC_SEARCH_BACKGROUND_INDEXING_ENABLED;

  beforeEach(() => {
    delete process.env.SEMANTIC_SEARCH_BACKGROUND_INDEXING_ENABLED;
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (original === undefined) delete process.env.SEMANTIC_SEARCH_BACKGROUND_INDEXING_ENABLED;
    else process.env.SEMANTIC_SEARCH_BACKGROUND_INDEXING_ENABLED = original;
  });

  it("defaults to enabled", () => {
    expect(isSemanticSearchBackgroundIndexingEnabled()).toBe(true);
  });

  it("does no tenant enumeration or reconciliation when disabled", async () => {
    process.env.SEMANTIC_SEARCH_BACKGROUND_INDEXING_ENABLED = "false";
    const service = { reconcile: jest.fn() };
    const tenants = { runForEachTenant: jest.fn(), runWithTenant: jest.fn() };
    const cron = new SemanticSearchIndexCron(service as never, tenants as never);

    await cron.reconcile();

    expect(tenants.runForEachTenant).not.toHaveBeenCalled();
    expect(service.reconcile).not.toHaveBeenCalled();
  });

  it("continues tenant-scoped scheduled indexing by default", async () => {
    const service = { reconcile: jest.fn().mockResolvedValue({ pending: 0 }) };
    const tenants = {
      runForEachTenant: jest.fn(async (callback: (id: string) => Promise<void>) => {
        await callback("tenant");
      }),
      runWithTenant: jest.fn(async (_id: string, callback: () => Promise<void>) => {
        await callback();
      }),
    };
    const cron = new SemanticSearchIndexCron(service as never, tenants as never);

    await cron.reconcile();

    expect(tenants.runWithTenant).toHaveBeenCalledWith("tenant", expect.any(Function));
    expect(service.reconcile).toHaveBeenCalledWith("tenant", { offset: 0 });
  });

  it("does not create a consuming worker or request its Redis connection when disabled", async () => {
    process.env.SEMANTIC_SEARCH_BACKGROUND_INDEXING_ENABLED = "false";
    const queue = { getConnection: jest.fn() };
    const worker = new SemanticSearchIndexWorker(queue as never, {} as never, {} as never);

    expect(Worker).not.toHaveBeenCalled();
    expect(queue.getConnection).not.toHaveBeenCalled();
    await expect(worker.onModuleDestroy()).resolves.toBeUndefined();
  });

  it("preserves tenant-scoped processing and worker cleanup when enabled", async () => {
    const close = jest.fn().mockResolvedValue(undefined);
    jest.mocked(Worker).mockImplementation(() => ({ on: jest.fn(), close }) as never);
    const queue = { getConnection: jest.fn().mockReturnValue({ host: "redis" }) };
    const service = { process: jest.fn().mockResolvedValue(undefined) };
    const tenants = {
      runWithTenant: jest.fn(async (_id: string, callback: () => Promise<void>) => {
        await callback();
      }),
    };
    const worker = new SemanticSearchIndexWorker(
      queue as never,
      service as never,
      tenants as never,
    );
    const processor = jest.mocked(Worker).mock.calls[0][1] as (job: {
      name: string;
      data: { tenantId: string };
    }) => Promise<void>;
    const data = { tenantId: "tenant" };

    await processor({ name: "index-source", data });
    expect(tenants.runWithTenant).toHaveBeenCalledWith("tenant", expect.any(Function));
    expect(service.process).toHaveBeenCalledWith(data);
    await worker.onModuleDestroy();
    expect(close).toHaveBeenCalledTimes(1);
  });
});
