import { Inject, Injectable, Logger, type OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Worker } from "bullmq";
import { eq } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { buildRedisConnection } from "src/common/configuration/redis";
import { lessons } from "src/storage/schema";

import { VideoProcessingStateService } from "./video-processing-state.service";

import type { Job } from "bullmq";
import type { RedisConfigSchema } from "src/common/configuration/redis";

@Injectable()
export class VideoUploadWorker implements OnModuleDestroy {
  private readonly logger = new Logger(VideoUploadWorker.name);
  private worker: Worker;

  constructor(
    private readonly configService: ConfigService,
    private readonly videoProcessingStateService: VideoProcessingStateService,
    @Inject("DB") private readonly db: DatabasePg,
  ) {
    const redisCfg = this.configService.get("redis") as RedisConfigSchema;
    const connection = redisCfg && buildRedisConnection(redisCfg);

    this.worker = new Worker(
      "video-upload",
      async (job: Job) => {
        const { fileKey, fileUrl, uploadId, placeholderKey, fileType, lessonId } = job.data;
        this.logger.log(`Processing video upload job ${job.id} for uploadId: ${uploadId}`);

        try {
          this.logger.log(`Video uploaded to Bunny for ${uploadId}, fileKey: ${fileKey}`);

          await this.videoProcessingStateService.markUploaded({
            uploadId,
            fileKey,
            fileUrl,
            placeholderKey,
            fileType,
            bunnyVideoId: fileKey.replace("bunny-", ""),
          });

          let updatedLesson;
          if (lessonId) {
            const updateResult = await this.db
              .update(lessons)
              .set({ fileS3Key: fileKey, fileType })
              .where(eq(lessons.id, lessonId))
              .returning();

            updatedLesson = updateResult.length > 0;

            this.logger.log(`Updated lesson ${lessonId} with fileKey: ${fileKey}`);
          } else {
            const state = await this.videoProcessingStateService.getState(uploadId);

            if (state?.lessonId) {
              const updateResult = await this.db
                .update(lessons)
                .set({ fileS3Key: fileKey, fileType })
                .where(eq(lessons.id, state.lessonId))
                .returning();

              updatedLesson = updateResult.length > 0;

              this.logger.log(`Updated lesson ${state.lessonId} with fileKey: ${fileKey}`);
            } else {
              const updateResult = await this.db
                .update(lessons)
                .set({ fileS3Key: fileKey, fileType })
                .where(eq(lessons.fileS3Key, placeholderKey))
                .returning();

              updatedLesson = updateResult.length > 0;

              this.logger.log(
                `Updated lesson by placeholder ${placeholderKey} with fileKey: ${fileKey}`,
              );
            }
          }

          if (!updatedLesson) {
            this.logger.warn(`No lesson was updated for uploadId: ${uploadId}`);
          }

          this.logger.log(
            `Successfully completed video upload job ${job.id} for uploadId: ${uploadId}`,
          );
          return {
            success: true,
            fileKey,
            fileUrl,
          };
        } catch (error) {
          this.logger.error(`Video upload failed for job ${job.id}, uploadId: ${uploadId}:`, error);
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
