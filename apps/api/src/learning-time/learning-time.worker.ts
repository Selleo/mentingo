import { Injectable, Logger, type OnModuleDestroy } from "@nestjs/common";
import { Worker } from "bullmq";
import { validate as uuidValidate } from "uuid";

import { LearningTimeRepository } from "src/learning-time/learning-time.repository";
import { QUEUE_NAMES, QueueService } from "src/queue";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import type { Job } from "bullmq";
import type { LearningTimeJobData } from "src/queue/queue.types";

@Injectable()
export class LearningTimeWorker implements OnModuleDestroy {
  private worker: Worker;
  private readonly logger = new Logger(LearningTimeWorker.name);

  constructor(
    private readonly queueService: QueueService,
    private readonly learningTimeRepository: LearningTimeRepository,
    private readonly tenantRunner: TenantDbRunnerService,
  ) {
    const connection = this.queueService.getConnection();

    this.worker = new Worker(
      QUEUE_NAMES.LEARNING_TIME,
      async (job: Job<LearningTimeJobData>) => {
        return this.processJob(job);
      },
      {
        connection,
        concurrency: 5,
      },
    );

    this.worker.on("completed", (job) => {
      this.logger.debug(`Learning time job ${job.id} completed`);
    });

    this.worker.on("failed", (job, err) => {
      this.logger.error(`Learning time job ${job?.id} failed: ${err.message}`);
    });
  }

  private async processJob(job: Job<LearningTimeJobData>) {
    const { userId, lessonId, courseId, tenantId, secondsToAdd } = job.data;

    try {
      if (!tenantId || !uuidValidate(tenantId)) {
        this.logger.warn(
          `Learning time job ${job.id} is missing a valid tenantId; processing without tenant scope`,
        );
        const normalizedCourseId = await this.normalizeCourseId(courseId, lessonId);
        await this.learningTimeRepository.addLearningTime(
          userId,
          lessonId,
          normalizedCourseId,
          secondsToAdd,
        );
      } else {
        await this.tenantRunner.runWithTenant(tenantId, async () => {
          const normalizedCourseId = await this.normalizeCourseId(courseId, lessonId);
          await this.learningTimeRepository.addLearningTime(
            userId,
            lessonId,
            normalizedCourseId,
            secondsToAdd,
          );
        });
      }

      this.logger.debug(
        `Added ${secondsToAdd}s learning time for user ${userId} on lesson ${lessonId}`,
      );

      return { success: true };
    } catch (error) {
      this.logger.error(`Failed to add learning time: ${error}`);
      throw error;
    }
  }

  private async normalizeCourseId(courseId: string, lessonId: string): Promise<string> {
    if (uuidValidate(courseId)) return courseId;

    const resolvedCourseId = await this.learningTimeRepository.getCourseIdByLessonId(lessonId);

    if (!resolvedCourseId)
      throw new Error(
        `Invalid courseId (${courseId}) and unable to resolve by lessonId (${lessonId})`,
      );

    return resolvedCourseId;
  }

  async onModuleDestroy() {
    await this.worker?.close();
  }
}
