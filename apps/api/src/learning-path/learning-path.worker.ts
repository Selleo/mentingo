import { Injectable, Logger, type OnModuleDestroy } from "@nestjs/common";
import { Worker } from "bullmq";

import { QUEUE_NAMES, QueueService } from "src/queue";

import { LearningPathExportService } from "./services/learning-path-export.service";

import type { Job } from "bullmq";
import type { LearningPathExportJobData, LearningPathSyncJobData } from "src/queue/queue.types";

@Injectable()
export class LearningPathWorker implements OnModuleDestroy {
  private readonly logger = new Logger(LearningPathWorker.name);
  private readonly exportWorker: Worker<LearningPathExportJobData>;
  private readonly syncWorker: Worker<LearningPathSyncJobData>;

  constructor(
    private readonly queueService: QueueService,
    private readonly learningPathExportService: LearningPathExportService,
  ) {
    const connection = this.queueService.getConnection();

    this.exportWorker = new Worker(
      QUEUE_NAMES.LEARNING_PATH_EXPORT,
      async (job: Job<LearningPathExportJobData>) => {
        await this.learningPathExportService.processExportJob(job.data);
      },
      {
        connection,
        concurrency: Number(process.env.WORKER_CONCURRENCY || 5),
      },
    );

    this.syncWorker = new Worker(
      QUEUE_NAMES.LEARNING_PATH_SYNC,
      async (job: Job<LearningPathSyncJobData>) => {
        await this.learningPathExportService.processSyncJob(job.data);
      },
      {
        connection,
        concurrency: Number(process.env.WORKER_CONCURRENCY || 5),
      },
    );

    this.exportWorker.on("failed", (job, err) => {
      this.logger.error(`Learning path export job ${job?.id} failed: ${err.message}`);
    });

    this.syncWorker.on("failed", (job, err) => {
      this.logger.error(`Learning path sync job ${job?.id} failed: ${err.message}`);
    });
  }

  async onModuleDestroy() {
    await Promise.all([this.exportWorker.close(), this.syncWorker.close()]);
  }
}
