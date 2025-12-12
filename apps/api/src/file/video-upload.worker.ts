import { Inject, Injectable, type OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Worker } from "bullmq";
import { eq } from "drizzle-orm";

import { BunnyStreamService } from "src/bunny/bunnyStream.service";
import { DatabasePg } from "src/common";
import { buildRedisConnection } from "src/common/configuration/redis";
import { lessons } from "src/storage/schema";

import { VideoProcessingStateService } from "./video-processing-state.service";

import type { Job } from "bullmq";
import type { RedisConfigSchema } from "src/common/configuration/redis";

@Injectable()
export class VideoUploadWorker implements OnModuleDestroy {
  private worker: Worker;

  constructor(
    private readonly configService: ConfigService,
    private readonly bunnyStreamService: BunnyStreamService,
    private readonly videoProcessingStateService: VideoProcessingStateService,
    @Inject("DB") private readonly db: DatabasePg,
  ) {
    const redisCfg = this.configService.get("redis") as RedisConfigSchema;
    const connection = redisCfg && buildRedisConnection(redisCfg);

    this.worker = new Worker(
      "video-upload",
      async (job: Job) => {
        try {
          const { uploadId, placeholderKey, fileType, lessonId } = job.data;
          const newFile = {
            ...job.data.file,
            buffer: Buffer.from(job.data.file.buffer.data),
          };

          const result = await this.bunnyStreamService.upload(newFile);

          await this.videoProcessingStateService.markUploaded({
            uploadId,
            bunnyVideoId: result.fileKey.replace("bunny-", ""),
            fileKey: result.fileKey,
            fileUrl: result.fileUrl,
            placeholderKey,
            fileType,
          });

          // Update lesson immediately when video is uploaded to Bunny
          // Video should be playable even before full processing
          if (lessonId) {
            // If we have lessonId from job data, update by ID (for existing lessons being edited)
            await this.db
              .update(lessons)
              .set({ fileS3Key: result.fileKey, fileType })
              .where(eq(lessons.id, lessonId));
          } else {
            // Check if lessonId was associated later via associateUploadWithLesson
            const state = await this.videoProcessingStateService.getState(uploadId);
            if (state?.lessonId) {
              await this.db
                .update(lessons)
                .set({ fileS3Key: result.fileKey, fileType })
                .where(eq(lessons.id, state.lessonId));
            } else {
              // Fallback to placeholder key for cases where association hasn't happened yet
              await this.db
                .update(lessons)
                .set({ fileS3Key: result.fileKey, fileType })
                .where(eq(lessons.fileS3Key, placeholderKey));
            }
          }

          return {
            success: true,
            fileKey: result.fileKey,
            fileUrl: result.fileUrl,
          };
        } catch (error) {
          console.error("Video upload failed:", error);
          await this.videoProcessingStateService.markFailed(
            job.data?.uploadId,
            job.data?.placeholderKey,
            error.message,
          );
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
