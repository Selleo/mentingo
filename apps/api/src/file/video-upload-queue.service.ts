import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { type Job, Queue, QueueEvents } from "bullmq";

import { buildRedisConnection } from "src/common/configuration/redis";

import type { OnModuleDestroy } from "@nestjs/common";
import type { RedisConfigSchema } from "src/common/configuration/redis";

@Injectable()
export class VideoUploadQueueService implements OnModuleDestroy {
  private readonly logger = new Logger(VideoUploadQueueService.name);
  private videoUploadQueue: Queue;
  private videoUploadQueueEvents: QueueEvents;

  constructor(private readonly config: ConfigService) {
    const redisCfg = this.config.get("redis") as RedisConfigSchema;
    const connection = redisCfg && buildRedisConnection(redisCfg);

    this.videoUploadQueue = new Queue("video-upload", { connection });
    this.videoUploadQueueEvents = new QueueEvents("video-upload", { connection });
  }

  async enqueueVideoUpload(
    fileKey: string,
    fileUrl: string,
    resource: string,
    uploadId: string,
    placeholderKey: string,
    fileType?: string,
    lessonId?: string,
  ) {
    try {
      if (!uploadId || !placeholderKey) {
        throw new Error("uploadId and placeholderKey are required");
      }

      const job = await this.videoUploadQueue.add(
        "video-upload",
        { fileKey, fileUrl, resource, uploadId, placeholderKey, fileType, lessonId },
        {
          attempts: 3,
          backoff: { type: "exponential", delay: 1000 },
          removeOnComplete: 10,
          removeOnFail: 5,
        },
      );

      this.logger.log(`Enqueued video upload job ${job.id} for uploadId: ${uploadId}`);
      return job;
    } catch (error) {
      this.logger.error(`Failed to enqueue video upload for ${uploadId}:`, error);
      throw error;
    }
  }

  async waitForJobsCompletion(jobs: Job[]) {
    await this.videoUploadQueueEvents.waitUntilReady();

    return Promise.allSettled(jobs.map((j) => j.waitUntilFinished(this.videoUploadQueueEvents)));
  }

  async onModuleDestroy() {
    await this.videoUploadQueue.close();
    await this.videoUploadQueueEvents.close();
  }
}
