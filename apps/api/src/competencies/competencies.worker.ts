import { Injectable, Logger, type OnModuleDestroy } from "@nestjs/common";
import { Value } from "@sinclair/typebox/value";
import { Worker } from "bullmq";

import { QUEUE_NAMES, QueueService } from "src/queue";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import { CompetenciesSyncService } from "./competencies-sync.service";
import { competenciesJobSchema } from "./schemas/competencies-job.schema";

import type { CompetenciesJobData } from "./competencies.types";

@Injectable()
export class CompetenciesWorker implements OnModuleDestroy {
  private readonly worker: Worker<CompetenciesJobData>;
  private readonly logger = new Logger(CompetenciesWorker.name);
  constructor(
    queueService: QueueService,
    tenantDbRunnerService: TenantDbRunnerService,
    competenciesSyncService: CompetenciesSyncService,
  ) {
    this.worker = new Worker<CompetenciesJobData>(
      QUEUE_NAMES.COMPETENCIES,
      async (job) => {
        if (!Value.Check(competenciesJobSchema, job.data))
          throw new Error("Invalid competencies synchronization job");

        await tenantDbRunnerService.runWithTenant(job.data.tenantId, () =>
          competenciesSyncService.reconcileCourseLearningFacts(
            job.data.subjectId,
            job.data.courseId,
          ),
        );
      },
      { connection: queueService.getConnection(), concurrency: 1 },
    );
    this.worker.on("failed", () =>
      this.logger.warn("Competency operation failed; retry or reconciliation is required"),
    );
  }
  async onModuleDestroy() {
    await this.worker.close();
  }
}
