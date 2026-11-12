import { Test } from "@nestjs/testing";
import { VIDEO_PROVIDERS } from "@repo/shared";

import { QUEUE_SANDBOX_PROCESS_ENV } from "src/queue/queue.constants";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import { AudioDurationBackfillCron } from "./audio-duration-backfill.cron";
import { VideoMetadataQueueService } from "./video-metadata.queue.service";
import { VideoMetadataRepository } from "./video-metadata.repository";

import type { UUIDType } from "src/common";

const tenantId = "11111111-1111-4111-8111-111111111111" as UUIDType;
const otherTenantId = "22222222-2222-4222-8222-222222222222" as UUIDType;
const resourceId = "33333333-3333-4333-8333-333333333333";

describe("audio duration backfill scheduling", () => {
  const originalSandbox = process.env[QUEUE_SANDBOX_PROCESS_ENV];

  afterEach(() => {
    if (originalSandbox === undefined) delete process.env[QUEUE_SANDBOX_PROCESS_ENV];
    else process.env[QUEUE_SANDBOX_PROCESS_ENV] = originalSandbox;
  });

  const setup = async () => {
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
    const testingModule = await Test.createTestingModule({
      providers: [
        AudioDurationBackfillCron,
        { provide: VideoMetadataRepository, useValue: videoMetadataRepository },
        { provide: VideoMetadataQueueService, useValue: videoMetadataQueueService },
        { provide: TenantDbRunnerService, useValue: tenantDbRunnerService },
      ],
    }).compile();
    const cron = testingModule.get(AudioDurationBackfillCron);
    return { cron, videoMetadataRepository, videoMetadataQueueService, tenantDbRunnerService };
  };

  it("enqueues metadata jobs for each tenant's audio missing a duration", async () => {
    const { cron, videoMetadataRepository, videoMetadataQueueService, tenantDbRunnerService } =
      await setup();
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

  it("does not scan inside a queue sandbox process", async () => {
    const { cron, tenantDbRunnerService } = await setup();
    process.env[QUEUE_SANDBOX_PROCESS_ENV] = "true";
    await cron.enqueueMissingAudioDurations();
    expect(tenantDbRunnerService.runForEachTenant).not.toHaveBeenCalled();
  });

  it("advances its keyset on later ticks and wraps after an empty page", async () => {
    const { cron, videoMetadataRepository } = await setup();
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
      await setup();
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
    const { cron, videoMetadataRepository, videoMetadataQueueService } = await setup();
    videoMetadataQueueService.enqueueReady.mockRejectedValueOnce(new Error("queue unavailable"));
    await cron.enqueueMissingAudioDurations();
    await cron.enqueueMissingAudioDurations();
    expect(videoMetadataRepository.findAudioMissingDuration).toHaveBeenNthCalledWith(
      2,
      tenantId,
      undefined,
      100,
    );
  });

  it("continues with later tenants when one tenant fails", async () => {
    const { cron, videoMetadataRepository, videoMetadataQueueService, tenantDbRunnerService } =
      await setup();
    tenantDbRunnerService.runForEachTenant.mockImplementation(async (callback) => {
      await callback(tenantId);
      await callback(otherTenantId);
    });
    videoMetadataRepository.findAudioMissingDuration.mockRejectedValueOnce(
      new Error("query failed"),
    );
    await cron.enqueueMissingAudioDurations();
    expect(videoMetadataQueueService.enqueueReady).toHaveBeenCalledTimes(1);
    expect(videoMetadataQueueService.enqueueReady).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: otherTenantId }),
    );
  });

  it("does not overlap scans when a previous tick is still running", async () => {
    const { cron, videoMetadataQueueService, tenantDbRunnerService } = await setup();
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
