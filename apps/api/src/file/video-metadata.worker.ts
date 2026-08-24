import { Injectable, Logger, type OnModuleDestroy } from "@nestjs/common";
import { Worker } from "bullmq";

import { QUEUE_NAMES, QueueService } from "src/queue";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import { VideoMetadataService } from "./video-metadata.service";

import type { Job } from "bullmq";
import type { VideoMetadataJobData } from "src/queue/queue.types";

@Injectable()
export class VideoMetadataWorker implements OnModuleDestroy {
  private readonly logger = new Logger(VideoMetadataWorker.name);
  private readonly worker: Worker<VideoMetadataJobData>;

  constructor(
    private readonly queueService: QueueService,
    private readonly tenantRunner: TenantDbRunnerService,
    private readonly metadataService: VideoMetadataService,
  ) {
    this.worker = new Worker<VideoMetadataJobData>(
      QUEUE_NAMES.VIDEO_METADATA,
      (job) => this.process(job),
      {
        connection: this.queueService.getConnection(),
        concurrency: Number(process.env.VIDEO_METADATA_WORKER_CONCURRENCY || 2),
      },
    );
    this.worker.on("failed", (job, error) => {
      this.logger.error(
        `Video metadata job failed: id=${job?.id}, tenant=${job?.data.tenantId}, resource=${job?.data.resourceId}, provider=${job?.data.provider}, reason=${error.message}`,
      );
    });
  }

  private process(job: Job<VideoMetadataJobData>) {
    return this.tenantRunner.runWithTenant(job.data.tenantId, () =>
      this.metadataService.process(job.data),
    );
  }

  async onModuleDestroy() {
    await this.worker.close();
  }
}
