import {
  HttpException,
  Injectable,
  InternalServerErrorException,
  type OnModuleDestroy,
} from "@nestjs/common";
import { Worker } from "bullmq";

import { QUEUE_NAMES, QueueService } from "src/queue";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import { SCORM_IMPORT_JOB_NAME } from "./scorm-queue.service";
import { ScormService } from "./scorm.service";

import type {
  ScormImportJobData,
  ScormImportJobFailure,
  ScormImportJobResult,
} from "./scorm.types";
import type { Job } from "bullmq";

@Injectable()
export class ScormImportWorker implements OnModuleDestroy {
  private readonly worker: Worker<ScormImportJobData, ScormImportJobResult>;

  constructor(
    private readonly queueService: QueueService,
    private readonly scormService: ScormService,
    private readonly tenantDbRunnerService: TenantDbRunnerService,
  ) {
    this.worker = new Worker<ScormImportJobData, ScormImportJobResult>(
      QUEUE_NAMES.SCORM_IMPORT,
      (job) => this.handleScormImport(job),
      {
        connection: this.queueService.getConnection(),
        concurrency: Number(process.env.SCORM_WORKER_CONCURRENCY || 1),
      },
    );
  }

  private async handleScormImport(job: Job<ScormImportJobData>): Promise<ScormImportJobResult> {
    if (job.name !== SCORM_IMPORT_JOB_NAME) {
      throw new InternalServerErrorException(`Unexpected SCORM import job name: ${job.name}`);
    }

    try {
      const data = await this.tenantDbRunnerService.runWithTenant(
        job.data.currentUser.tenantId,
        () => this.scormService.processQueuedImportJob(job.data),
      );

      return { success: true, data };
    } catch (error) {
      await this.tenantDbRunnerService.runWithTenant(job.data.currentUser.tenantId, () =>
        this.scormService.handleQueuedImportFailure(job.data),
      );

      if (error instanceof HttpException) return this.toFailureResult(error);

      throw error;
    }
  }

  private toFailureResult(error: HttpException): ScormImportJobFailure {
    return {
      success: false,
      statusCode: error.getStatus(),
      message: error.message,
      response: error.getResponse(),
    };
  }

  async onModuleDestroy() {
    await this.worker.close();
  }
}
