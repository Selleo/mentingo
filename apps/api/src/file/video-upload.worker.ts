import { Inject, Injectable, Logger, type OnModuleDestroy } from "@nestjs/common";
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
  private readonly logger = new Logger(VideoUploadWorker.name);
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
        const { uploadId, placeholderKey, fileType, lessonId } = job.data;
        this.logger.log(`Processing video upload job ${job.id} for uploadId: ${uploadId}`);

        try {
          const newFile = {
            ...job.data.file,
            buffer: Buffer.from(job.data.file.buffer.data),
          };

          const result = await this.bunnyStreamService.upload(newFile);
          this.logger.log(`Video uploaded to Bunny for ${uploadId}, fileKey: ${result.fileKey}`);

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
          let updatedLesson = false;
          if (lessonId) {
            // If we have lessonId from job data, update by ID (for existing lessons being edited)
            const updateResult = await this.db
              .update(lessons)
              .set({ fileS3Key: result.fileKey, fileType })
              .where(eq(lessons.id, lessonId))
              .returning();
            updatedLesson = updateResult.length > 0;
            this.logger.log(`Updated lesson ${lessonId} with fileKey: ${result.fileKey}`);
          } else {
            // Check if lessonId was associated later via associateUploadWithLesson
            const state = await this.videoProcessingStateService.getState(uploadId);
            if (state?.lessonId) {
              const updateResult = await this.db
                .update(lessons)
                .set({ fileS3Key: result.fileKey, fileType })
                .where(eq(lessons.id, state.lessonId))
                .returning();
              updatedLesson = updateResult.length > 0;
              this.logger.log(`Updated lesson ${state.lessonId} with fileKey: ${result.fileKey}`);
            } else {
              // Fallback to placeholder key for cases where association hasn't happened yet
              const updateResult = await this.db
                .update(lessons)
                .set({ fileS3Key: result.fileKey, fileType })
                .where(eq(lessons.fileS3Key, placeholderKey))
                .returning();
              updatedLesson = updateResult.length > 0;
              this.logger.log(
                `Updated lesson by placeholder ${placeholderKey} with fileKey: ${result.fileKey}`,
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
            fileKey: result.fileKey,
            fileUrl: result.fileUrl,
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
