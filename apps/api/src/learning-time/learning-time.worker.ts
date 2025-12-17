import { Injectable, Logger, type OnModuleDestroy } from "@nestjs/common";
import { Worker } from "bullmq";

import { LearningTimeRepository } from "src/learning-time/learning-time.repository";
import { QUEUE_NAMES, QueueService } from "src/queue";

import type { Job } from "bullmq";
import type { LearningTimeJobData } from "src/queue/queue.types";

@Injectable()
export class LearningTimeWorker implements OnModuleDestroy {
  private worker: Worker;
  private readonly logger = new Logger(LearningTimeWorker.name);

  constructor(
    private readonly queueService: QueueService,
    private readonly learningTimeRepository: LearningTimeRepository,
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
    const { userId, lessonId, courseId, secondsToAdd } = job.data;

    try {
      await this.learningTimeRepository.addLearningTime(userId, lessonId, courseId, secondsToAdd);

      this.logger.debug(
        `Added ${secondsToAdd}s learning time for user ${userId} on lesson ${lessonId}`,
      );

      return { success: true };
    } catch (error) {
      this.logger.error(`Failed to add learning time: ${error}`);
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.worker?.close();
  }
}
