import { Injectable, Logger, type OnModuleDestroy } from "@nestjs/common";
import { Worker } from "bullmq";

import { QUEUE_NAMES, QueueService } from "src/queue";

import { REPORT_EXPORT_ACTION } from "./constants/reports.constants";
import { ReportsExportsService } from "./reports-exports.service";

import type { Job } from "bullmq";
import type { ReportExportJobData } from "src/queue/queue.types";

@Injectable()
export class ReportsExportWorker implements OnModuleDestroy {
  private readonly logger = new Logger(ReportsExportWorker.name);
  private readonly worker: Worker<ReportExportJobData>;

  constructor(queueService: QueueService, reportsExportsService: ReportsExportsService) {
    this.worker = new Worker(
      QUEUE_NAMES.REPORT_EXPORT,
      (job: Job<ReportExportJobData>) => this.processReportExportJob(job, reportsExportsService),
      {
        connection: queueService.getConnection(),
        concurrency: Number(process.env.REPORT_EXPORT_WORKER_CONCURRENCY || 1),
      },
    );
    this.worker.on("failed", (job, error) => {
      this.logger.error(`Report export job ${job?.id} failed: ${error.message}`);
    });
  }

  async onModuleDestroy() {
    await this.worker?.close();
  }

  private async processReportExportJob(
    job: Job<ReportExportJobData>,
    reportsExportsService: ReportsExportsService,
  ): Promise<void> {
    if (job.data.action === REPORT_EXPORT_ACTION.EXPIRE) {
      await reportsExportsService.processExportExpirationJob(job.data);
      return;
    }

    const isFinalAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
    await reportsExportsService.processExportGenerationJob(job.data, isFinalAttempt);
  }
}
