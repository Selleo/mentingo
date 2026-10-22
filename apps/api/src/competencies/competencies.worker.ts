import { Injectable, Logger, type OnModuleDestroy } from "@nestjs/common";
import { Worker } from "bullmq";

import { QUEUE_NAMES, QueueService } from "src/queue";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import { CompetenciesAssignmentService } from "./competencies-assignment.service";
import { CompetenciesSyncService } from "./competencies-sync.service";

import type { CompetenciesJobData } from "./competencies.types";

@Injectable()
export class CompetenciesWorker implements OnModuleDestroy {
  private readonly worker: Worker<CompetenciesJobData>;
  private readonly logger = new Logger(CompetenciesWorker.name);
  constructor(
    queueService: QueueService,
    tenantDbRunnerService: TenantDbRunnerService,
    competenciesSyncService: CompetenciesSyncService,
    competenciesAssignmentService: CompetenciesAssignmentService,
  ) {
    this.worker = new Worker<CompetenciesJobData>(
      QUEUE_NAMES.COMPETENCIES,
      (job) =>
        tenantDbRunnerService.runWithTenant(job.data.tenantId, async () => {
          const data = job.data;
          if (data.operation === "sync") {
            await competenciesSyncService.synchronize(data.subjectId, data.courseId);
            return;
          }
          await competenciesAssignmentService.perform(data.actorId, data.actionId, data.requestId);
        }),
      { connection: queueService.getConnection(), concurrency: 1 },
    );
    this.worker.on("failed", (job) => {
      this.logger.warn("Competency operation failed; retry or reconciliation is required");
      if (job?.data.operation === "assignment" && job.attemptsMade >= (job.opts.attempts ?? 1)) {
        const data = job.data;
        void tenantDbRunnerService
          .runWithTenant(data.tenantId, () =>
            competenciesAssignmentService.failed(data.actionId, data.requestId, data.subjectId),
          )
          .catch(() =>
            this.logger.warn("Competency assignment failure receipt could not be delivered"),
          );
      }
    });
  }
  async onModuleDestroy() {
    await this.worker.close();
  }
}
