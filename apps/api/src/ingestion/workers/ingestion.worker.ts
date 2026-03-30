import { Injectable, Logger, type OnModuleDestroy } from "@nestjs/common";
import { Worker } from "bullmq";

import { IngestionProcessingService } from "src/ingestion/services/ingestion-processing.service";
import { QUEUE_NAMES, QueueService } from "src/queue";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import type { Job } from "bullmq";
import type { DocumentIngestionJobData } from "src/queue/queue.types";

@Injectable()
export class IngestionWorker implements OnModuleDestroy {
  private readonly logger = new Logger(IngestionWorker.name);
  private readonly worker: Worker;

  constructor(
    private readonly queueService: QueueService,
    private readonly ingestionProcessingService: IngestionProcessingService,
    private readonly tenantDbRunnerService: TenantDbRunnerService,
  ) {
    const connection = this.queueService.getConnection();
    this.logger.log(`Initializing worker for queue: ${QUEUE_NAMES.DOCUMENT_INGESTION}`);

    this.worker = new Worker(
      QUEUE_NAMES.DOCUMENT_INGESTION,
      async (job: Job<DocumentIngestionJobData>) => {
        if (job.name === "document-ingestion") {
          await this.handleDocumentIngestion(job);
        }
      },
      { connection, concurrency: Number(process.env.WORKER_CONCURRENCY || 10) },
    );

    this.worker.on("ready", () => {
      this.logger.log(`Worker ready for queue: ${QUEUE_NAMES.DOCUMENT_INGESTION}`);
    });

    this.worker.on("active", (job) => {
      this.logger.log(`Ingestion job started: id=${job.id}, name=${job.name}`);
    });

    this.worker.on("completed", (job) => {
      this.logger.log(`Ingestion job completed: id=${job.id}, name=${job.name}`);
    });

    this.worker.on("failed", (job, error) => {
      this.logger.error(
        `Ingestion job failed: id=${job?.id}, name=${job?.name}, reason=${error?.message}`,
        error?.stack,
      );
    });

    this.worker.on("error", (error) => {
      this.logger.error(`Ingestion worker error: ${error.message}`, error.stack);
    });
  }

  async handleDocumentIngestion(job: Job<DocumentIngestionJobData>) {
    const { tenantId } = job.data;

    if (!tenantId) {
      throw new Error(`Missing tenantId for ingestion job ${job.id}`);
    }

    return this.tenantDbRunnerService.runWithTenant(tenantId, async () =>
      this.ingestionProcessingService.processDocumentIngestion(job.data),
    );
  }

  async onModuleDestroy() {
    await this.worker?.close();
  }
}
