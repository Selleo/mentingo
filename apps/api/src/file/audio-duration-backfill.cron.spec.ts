import { VIDEO_PROVIDERS } from "@repo/shared";

import { FileModule } from "./files.module";

import type { UUIDType } from "src/common";

const tenantId = "11111111-1111-4111-8111-111111111111" as UUIDType;
const otherTenantId = "22222222-2222-4222-8222-222222222222" as UUIDType;
const resourceId = "33333333-3333-4333-8333-333333333333";

type BackfillCron = { enqueueMissingAudioDurations(): Promise<void> };

describe("audio duration backfill scheduling", () => {
  const originalBuildVerification = process.env.BUILD_VERIFICATION;
  const originalSandbox = process.env.QUEUE_SANDBOX_PROCESS;

  afterEach(() => {
    if (originalBuildVerification === undefined) delete process.env.BUILD_VERIFICATION;
    else process.env.BUILD_VERIFICATION = originalBuildVerification;
    if (originalSandbox === undefined) delete process.env.QUEUE_SANDBOX_PROCESS;
    else process.env.QUEUE_SANDBOX_PROCESS = originalSandbox;
  });

  const setup = () => {
    const providers = Reflect.getMetadata("providers", FileModule) as { name?: string }[];
    const provider = providers.find((candidate) => candidate.name === "AudioDurationBackfillCron");
    expect(provider).toBeDefined();
    const CronConstructor = provider as unknown as new (...args: unknown[]) => BackfillCron;
    const videoMetadataRepository = {
      findAudioMissingDuration: jest
        .fn()
        .mockResolvedValue([{ id: resourceId, reference: `${tenantId}/episode.wav` }]),
    };
    const videoMetadataQueueService = { enqueueReady: jest.fn().mockResolvedValue({}) };
    const tenantDbRunnerService = {
      runForEachTenant: jest.fn(async (callback: (id: UUIDType) => Promise<void>) =>
        callback(tenantId),
      ),
    };
    const cron = new CronConstructor(
      videoMetadataRepository,
      videoMetadataQueueService,
      tenantDbRunnerService,
    );
    return { cron, videoMetadataRepository, videoMetadataQueueService, tenantDbRunnerService };
  };

  it("registers a bounded tenant-scoped cron and reuses idempotent metadata jobs", async () => {
    const { cron, videoMetadataRepository, videoMetadataQueueService, tenantDbRunnerService } =
      setup();
    await cron.enqueueMissingAudioDurations();
    expect(tenantDbRunnerService.runForEachTenant).toHaveBeenCalledTimes(1);
    expect(videoMetadataRepository.findAudioMissingDuration).toHaveBeenCalledWith(
      tenantId,
      undefined,
      100,
    );
    expect(videoMetadataQueueService.enqueueReady).toHaveBeenCalledWith({
      tenantId,
      resourceId,
      provider: VIDEO_PROVIDERS.S3,
      fileKey: `${tenantId}/episode.wav`,
    });
  });

  it.each(["BUILD_VERIFICATION", "QUEUE_SANDBOX_PROCESS"])(
    "does not scan during %s",
    async (environmentKey) => {
      const { cron, tenantDbRunnerService } = setup();
      process.env[environmentKey] = "true";
      await cron.enqueueMissingAudioDurations();
      expect(tenantDbRunnerService.runForEachTenant).not.toHaveBeenCalled();
    },
  );

  it("advances its keyset on later ticks and wraps after an empty page", async () => {
    const { cron, videoMetadataRepository } = setup();
    await cron.enqueueMissingAudioDurations();
    videoMetadataRepository.findAudioMissingDuration.mockResolvedValueOnce([]);
    await cron.enqueueMissingAudioDurations();
    await cron.enqueueMissingAudioDurations();
    expect(videoMetadataRepository.findAudioMissingDuration.mock.calls).toEqual([
      [tenantId, undefined, 100],
      [tenantId, resourceId, 100],
      [tenantId, undefined, 100],
    ]);
  });

  it("keeps independent cursors and job tenant IDs for each tenant", async () => {
    const { cron, videoMetadataRepository, videoMetadataQueueService, tenantDbRunnerService } =
      setup();
    tenantDbRunnerService.runForEachTenant.mockImplementation(async (callback) => {
      await callback(tenantId);
      await callback(otherTenantId);
    });
    await cron.enqueueMissingAudioDurations();
    expect(videoMetadataRepository.findAudioMissingDuration).toHaveBeenNthCalledWith(
      2,
      otherTenantId,
      undefined,
      100,
    );
    expect(videoMetadataQueueService.enqueueReady).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ tenantId: otherTenantId }),
    );
  });

  it("does not advance the cursor on queue failure so a later tick retries", async () => {
    const { cron, videoMetadataRepository, videoMetadataQueueService } = setup();
    videoMetadataQueueService.enqueueReady.mockRejectedValueOnce(new Error("queue unavailable"));
    await expect(cron.enqueueMissingAudioDurations()).rejects.toThrow("queue unavailable");
    await cron.enqueueMissingAudioDurations();
    expect(videoMetadataRepository.findAudioMissingDuration).toHaveBeenNthCalledWith(
      2,
      tenantId,
      undefined,
      100,
    );
  });

  it("does not overlap scans when a previous tick is still running", async () => {
    const { cron, videoMetadataQueueService, tenantDbRunnerService } = setup();
    let release: (() => void) | undefined;
    videoMetadataQueueService.enqueueReady.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    const pending = cron.enqueueMissingAudioDurations();
    await Promise.resolve();
    await Promise.resolve();
    await cron.enqueueMissingAudioDurations();
    expect(tenantDbRunnerService.runForEachTenant).toHaveBeenCalledTimes(1);
    release?.();
    await pending;
  });
});
