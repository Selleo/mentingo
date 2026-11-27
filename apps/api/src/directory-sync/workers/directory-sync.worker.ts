import { Injectable, Logger, type OnModuleDestroy } from "@nestjs/common";
import { Value } from "@sinclair/typebox/value";
import { type Job, Worker } from "bullmq";

import { QUEUE_NAMES, QueueService } from "src/queue";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import { directorySyncJobDataSchema } from "../schemas/directory-sync-job.schema";
import { DirectorySyncService } from "../services/directory-sync.service";

@Injectable()
export class DirectorySyncWorker implements OnModuleDestroy {
  private readonly logger = new Logger(DirectorySyncWorker.name);
  private readonly worker: Worker;

  constructor(
    queueService: QueueService,
    private readonly tenantDbRunnerService: TenantDbRunnerService,
    private readonly directorySyncService: DirectorySyncService,
  ) {
    this.worker = new Worker(QUEUE_NAMES.DIRECTORY_SYNC, (job) => this.synchronizeDirectory(job), {
      connection: queueService.getConnection(),
      concurrency: process.env.NODE_ENV === "test" ? 1 : 2,
    });
  }

  private async synchronizeDirectory(job: Job) {
    if (!Value.Check(directorySyncJobDataSchema, job.data)) {
      this.logger.error(`Directory sync job ${job.id} has invalid data`);
      return;
    }

    const { tenantId, runId } = job.data;

    await this.tenantDbRunnerService.runWithTenant(tenantId, () =>
      this.directorySyncService.synchronizeDirectoryForRun(runId),
    );
  }

  async onModuleDestroy() {
    await this.worker.close();
  }
}
