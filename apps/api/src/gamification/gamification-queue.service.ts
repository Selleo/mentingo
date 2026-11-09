import { Injectable, Logger, type OnModuleDestroy } from "@nestjs/common";
import { Worker, type Job } from "bullmq";
import { match } from "ts-pattern";

import { QUEUE_NAMES, QueueService } from "src/queue";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import { GAMIFICATION_JOB_OPTIONS, GAMIFICATION_JOBS } from "./gamification.constants";
import { GamificationService } from "./gamification.service";

import type { EvaluateUserJobData, RecalculateTenantJobData } from "./gamification.types";

type GamificationJob = Job<EvaluateUserJobData | RecalculateTenantJobData>;

@Injectable()
export class GamificationQueueService implements OnModuleDestroy {
  private readonly logger = new Logger(GamificationQueueService.name);
  private readonly worker: Worker<EvaluateUserJobData | RecalculateTenantJobData>;

  constructor(
    private readonly queueService: QueueService,
    private readonly tenantDbRunnerService: TenantDbRunnerService,
    private readonly gamificationService: GamificationService,
  ) {
    this.worker = new Worker(
      QUEUE_NAMES.GAMIFICATION,
      (job: GamificationJob) => this.process(job),
      {
        connection: this.queueService.getConnection(),
        concurrency: Number(process.env.WORKER_CONCURRENCY || 10),
      },
    );

    this.worker.on("failed", (job, error) => {
      this.logger.error(
        `Gamification job failed: id=${job?.id}, name=${job?.name}, tenant=${job?.data.tenantId}, reason=${error?.message}`,
        error?.stack,
      );
    });

    this.worker.on("error", (error) => {
      this.logger.error(`Gamification worker error: ${error.message}`, error.stack);
    });
  }

  /** The job id drops redeliveries of an event while its job is still queued; later ones re-run safely because evaluation is idempotent. */
  async enqueueEvaluateUser(data: EvaluateUserJobData) {
    await this.queueService.enqueue(
      QUEUE_NAMES.GAMIFICATION,
      GAMIFICATION_JOBS.EVALUATE_USER,
      data,
      {
        ...GAMIFICATION_JOB_OPTIONS,
        jobId: data.sourceEventId ? `${data.sourceEventId}-${data.userId}` : undefined,
      },
    );
  }

  async enqueueRecalculateTenant(data: RecalculateTenantJobData) {
    await this.queueService.enqueue(
      QUEUE_NAMES.GAMIFICATION,
      GAMIFICATION_JOBS.RECALCULATE_TENANT,
      data,
      GAMIFICATION_JOB_OPTIONS,
    );
  }

  async onModuleDestroy() {
    await this.worker.close();
  }

  private async process(job: GamificationJob) {
    await this.tenantDbRunnerService.runWithTenant(job.data.tenantId, () =>
      match(job.name)
        .with(GAMIFICATION_JOBS.EVALUATE_USER, async () => {
          const { userId, sourceEventId } = job.data as EvaluateUserJobData;
          const grantedXp = await this.gamificationService.evaluateUser(userId, sourceEventId);

          if (grantedXp > 0) this.logger.log(`Granted ${grantedXp} XP to user ${userId}`);
        })
        .with(GAMIFICATION_JOBS.RECALCULATE_TENANT, () =>
          this.gamificationService.recalculateTenant(),
        )
        .otherwise(() => {
          throw new Error(`Unknown gamification job: ${job.name}`);
        }),
    );
  }
}
