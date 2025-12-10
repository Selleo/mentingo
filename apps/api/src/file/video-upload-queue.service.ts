import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { type Job, Queue, QueueEvents } from "bullmq";

import { buildRedisConnection } from "src/common/configuration/redis";

import type { OnModuleDestroy } from "@nestjs/common";
import type { RedisConfigSchema } from "src/common/configuration/redis";

@Injectable()
export class VideoUploadQueueService implements OnModuleDestroy {
  private videoUploadQueue: Queue;
  private videoUploadQueueEvents: QueueEvents;

  constructor(private readonly config: ConfigService) {
    const redisCfg = this.config.get("redis") as RedisConfigSchema;
    const connection = redisCfg && buildRedisConnection(redisCfg);

    this.videoUploadQueue = new Queue("video-upload", { connection });
    this.videoUploadQueueEvents = new QueueEvents("video-upload", { connection });
  }

  async enqueueVideoUpload(file: Express.Multer.File, resource: string) {
    return this.videoUploadQueue.add(
      "video-upload",
      { file, resource },
      { attempts: 3, backoff: { type: "exponential", delay: 1000 } },
    );
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
