import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { type Job, Queue, QueueEvents } from "bullmq";

import { buildRedisConnection } from "src/common/configuration/redis";

import type { OnModuleDestroy } from "@nestjs/common";
import type { RedisConfigSchema } from "src/common/configuration/redis";

@Injectable()
export class QueueService implements OnModuleDestroy {
  private ingestQueue: Queue;
  private ingestQueueEvents: QueueEvents;

  constructor(private readonly config: ConfigService) {
    const redisCfg = this.config.get("redis") as RedisConfigSchema;
    const connection = redisCfg && buildRedisConnection(redisCfg);

    this.ingestQueue = new Queue("document-ingestion", { connection });
    this.ingestQueueEvents = new QueueEvents("document-ingestion", { connection });
  }

  async enqueueDocumentIngestion(file: Express.Multer.File, documentId: string, sha256: string) {
    return this.ingestQueue.add(
      "document-ingestion",
      { file, documentId, sha256 },
      { attempts: 3, backoff: { type: "exponential", delay: 1000 } },
    );
  }

  async waitForJobsCompletion(jobs: Job[]) {
    await this.ingestQueueEvents.waitUntilReady();

    return Promise.allSettled(jobs.map((j) => j.waitUntilFinished(this.ingestQueueEvents)));
  }

  async onModuleDestroy() {
    await this.ingestQueue.close();
    await this.ingestQueueEvents.close();
  }
}
