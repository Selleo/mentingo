import { Injectable, type OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Worker } from "bullmq";

import { BunnyStreamService } from "src/bunny/bunnyStream.service";
import { buildRedisConnection } from "src/common/configuration/redis";

import type { Job } from "bullmq";
import type { RedisConfigSchema } from "src/common/configuration/redis";

@Injectable()
export class VideoUploadWorker implements OnModuleDestroy {
  private worker: Worker;

  constructor(
    private readonly configService: ConfigService,
    private readonly bunnyStreamService: BunnyStreamService,
  ) {
    const redisCfg = this.configService.get("redis") as RedisConfigSchema;
    const connection = redisCfg && buildRedisConnection(redisCfg);

    this.worker = new Worker(
      "video-upload",
      async (job: Job) => {
        try {
          const newFile = {
            ...job.data.file,
            buffer: Buffer.from(job.data.file.buffer.data),
          };

          const result = await this.bunnyStreamService.upload(newFile);

          return {
            success: true,
            fileKey: result.fileKey,
            fileUrl: result.fileUrl,
          };
        } catch (error) {
          console.error("Video upload failed:", error);
          return {
            success: false,
            error: error.message,
          };
        }
      },
      { connection, concurrency: Number(process.env.VIDEO_WORKER_CONCURRENCY || 5) },
    );
  }

  async onModuleDestroy() {
    await this.worker?.close();
  }
}
