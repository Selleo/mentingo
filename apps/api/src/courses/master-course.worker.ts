import { Injectable, Logger, type OnModuleDestroy } from "@nestjs/common";
import { Worker } from "bullmq";

import { MasterCourseService } from "src/courses/master-course.service";
import { QUEUE_NAMES, QueueService } from "src/queue";

import type { Job } from "bullmq";
import type { MasterCourseExportJobData, MasterCourseSyncJobData } from "src/queue";

@Injectable()
export class MasterCourseWorker implements OnModuleDestroy {
  private readonly logger = new Logger(MasterCourseWorker.name);
  private readonly exportWorker: Worker<MasterCourseExportJobData>;
  private readonly syncWorker: Worker<MasterCourseSyncJobData>;

  constructor(
    private readonly queueService: QueueService,
    private readonly masterCourseService: MasterCourseService,
  ) {
    const connection = this.queueService.getConnection();

    this.exportWorker = new Worker(
      QUEUE_NAMES.MASTER_COURSE_EXPORT,
      async (job: Job<MasterCourseExportJobData>) => {
        await this.masterCourseService.processExportJob(job.data);
      },
      {
        connection,
        concurrency: Number(process.env.WORKER_CONCURRENCY || 5),
      },
    );

    this.syncWorker = new Worker(
      QUEUE_NAMES.MASTER_COURSE_SYNC,
      async (job: Job<MasterCourseSyncJobData>) => {
        await this.masterCourseService.processSyncJob(job.data);
      },
      {
        connection,
        concurrency: Number(process.env.WORKER_CONCURRENCY || 5),
      },
    );

    this.exportWorker.on("failed", (job, err) => {
      this.logger.error(`Master course export job ${job?.id} failed: ${err.message}`);
    });

    this.syncWorker.on("failed", (job, err) => {
      this.logger.error(`Master course sync job ${job?.id} failed: ${err.message}`);
    });
  }

  async onModuleDestroy() {
    await Promise.all([this.exportWorker.close(), this.syncWorker.close()]);
  }
}
