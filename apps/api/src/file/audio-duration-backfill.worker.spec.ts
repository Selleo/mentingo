import { execFileSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { VIDEO_PROVIDERS } from "@repo/shared";

import { ResourceVideoDurationUpdatedEvent } from "src/events";

import { VideoMetadataService } from "./video-metadata.service";

import type { UUIDType } from "src/common";

describe("legacy audio metadata worker compatibility", () => {
  it("probes real audio, persists ceil duration, and emits the course refresh event exactly once", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "legacy-audio-metadata-"));
    try {
      const filePath = path.join(directory, "episode.wav");
      execFileSync("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "sine=duration=1.25", filePath]);
      const resourceId = "33333333-3333-4333-8333-333333333333" as UUIDType;
      const tenantId = "11111111-1111-4111-8111-111111111111" as UUIDType;
      const metadata: { durationSeconds?: number; originalFilename: string } = {
        originalFilename: "episode.wav",
      };
      const trx = {};
      const updateDurationSeconds = jest.fn(async (_resourceId, duration) => {
        metadata.durationSeconds = duration;
      });
      const publish = jest.fn();
      const getSignedUrl = jest.fn(async () => filePath);
      const service = Object.assign(Object.create(VideoMetadataService.prototype), {
        videoMetadataRepository: {
          findResource: async () => ({
            id: resourceId,
            reference: `${tenantId}/episode.wav`,
            metadata,
          }),
          updateDurationSeconds,
        },
        tenantRunner: {
          transactionWithHandle: async (callback: (handle: unknown) => Promise<void>) =>
            callback(trx),
        },
        s3Service: { getSignedUrl },
        outboxPublisher: { publish },
      }) as VideoMetadataService;
      const job = {
        resourceId,
        tenantId,
        provider: VIDEO_PROVIDERS.S3,
        fileKey: `${tenantId}/episode.wav`,
      };
      await service.process(job);
      await service.process(job);
      expect(metadata).toEqual({ originalFilename: "episode.wav", durationSeconds: 2 });
      expect(updateDurationSeconds).toHaveBeenCalledWith(resourceId, 2, trx);
      expect(updateDurationSeconds).toHaveBeenCalledTimes(1);
      expect(publish).toHaveBeenCalledWith(expect.any(ResourceVideoDurationUpdatedEvent), trx);
      expect(publish).toHaveBeenCalledTimes(1);
      expect(getSignedUrl).toHaveBeenCalledTimes(1);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
