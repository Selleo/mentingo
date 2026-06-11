import { Injectable, Logger, type OnModuleDestroy } from "@nestjs/common";
import { Worker } from "bullmq";

import { LUMA_COURSE_GENERATION_SYNC_JOB_NAME } from "src/luma/luma-course-generation-sync-queue.service";
import { LumaCourseGenerationSyncService } from "src/luma/luma-course-generation-sync.service";
import { QUEUE_NAMES, QueueService } from "src/queue";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import type { Job } from "bullmq";
import type { LumaCourseGenerationSyncJobData } from "src/queue";

@Injectable()
export class LumaCourseGenerationSyncWorker implements OnModuleDestroy {
  private readonly logger = new Logger(LumaCourseGenerationSyncWorker.name);
  private readonly worker: Worker<LumaCourseGenerationSyncJobData>;

  constructor(
    private readonly queueService: QueueService,
    private readonly lumaCourseGenerationSyncService: LumaCourseGenerationSyncService,
    private readonly tenantDbRunnerService: TenantDbRunnerService,
  ) {
    this.worker = new Worker<LumaCourseGenerationSyncJobData>(
      QUEUE_NAMES.LUMA_COURSE_GENERATION_SYNC,
      (job) => this.handleSyncJob(job),
      {
        connection: this.queueService.getConnection(),
        concurrency: Number(process.env.LUMA_COURSE_GENERATION_SYNC_WORKER_CONCURRENCY || 1),
      },
    );

    this.worker.on("failed", (job, err) => {
      this.logger.error(`Luma course generation sync job ${job?.id} failed: ${err.message}`);
    });
  }

  private async handleSyncJob(job: Job<LumaCourseGenerationSyncJobData>) {
    if (job.name !== LUMA_COURSE_GENERATION_SYNC_JOB_NAME) {
      throw new Error(`Unexpected Luma course generation sync job name: ${job.name}`);
    }

    await this.tenantDbRunnerService.runWithTenant(job.data.currentUser.tenantId, () =>
      this.lumaCourseGenerationSyncService.processGeneratedCourseBundleSync(job.data),
    );
  }

  async onModuleDestroy() {
    await this.worker.close();
  }
}
