import { VIDEO_PROVIDERS } from "@repo/shared";

import { VideoMetadataQueueService } from "./video-metadata.queue.service";

describe("VideoMetadataQueueService", () => {
  it("uses deterministic, distinct ready and watchdog jobs with bounded retry policy", async () => {
    const enqueue = jest.fn().mockResolvedValue({ id: "job" });
    const service = new VideoMetadataQueueService({ enqueue } as never);
    const params = {
      tenantId: "11111111-1111-1111-1111-111111111111" as never,
      resourceId: "22222222-2222-2222-2222-222222222222" as never,
      provider: VIDEO_PROVIDERS.BUNNY,
      bunnyVideoId: "video-id",
    };

    await service.enqueueReady(params);
    await service.enqueueWatchdog(params);

    expect(enqueue).toHaveBeenNthCalledWith(
      1,
      "video-metadata",
      "video-metadata-ready",
      params,
      expect.objectContaining({
        jobId: "video-metadata-22222222-2222-2222-2222-222222222222-ready-video-id",
        attempts: 10,
        backoff: { type: "exponential", delay: 30_000 },
      }),
    );
    expect(enqueue.mock.calls[1]?.[3]).toEqual(
      expect.objectContaining({
        jobId: "video-metadata-22222222-2222-2222-2222-222222222222-watchdog-video-id",
        delay: 5 * 60 * 1000,
      }),
    );
    expect(enqueue.mock.calls[0]?.[3].jobId).not.toContain(":");
  });

  it("keeps S3 job identity scoped to the resource", async () => {
    const enqueue = jest.fn().mockResolvedValue({ id: "job" });
    const service = new VideoMetadataQueueService({ enqueue } as never);

    await service.enqueueWatchdog({
      tenantId: "11111111-1111-1111-1111-111111111111" as never,
      resourceId: "22222222-2222-2222-2222-222222222222" as never,
      provider: VIDEO_PROVIDERS.S3,
      fileKey: "videos/example.mp4",
    });

    expect(enqueue.mock.calls[0]?.[3]).toEqual(
      expect.objectContaining({
        jobId: "video-metadata-22222222-2222-2222-2222-222222222222-watchdog",
      }),
    );
  });
});
