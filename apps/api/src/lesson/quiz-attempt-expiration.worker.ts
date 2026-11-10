import { Injectable, Logger, type OnModuleDestroy } from "@nestjs/common";
import { DelayedError, Worker } from "bullmq";
import { match } from "ts-pattern";

import { QUEUE_NAMES, QueueService } from "src/queue";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import {
  QUIZ_ATTEMPT_EXPIRATION_JOB_NAME,
  QUIZ_ATTEMPT_FINALIZATION_STATUSES,
} from "./repositories/lesson.constants";
import { LessonService } from "./services/lesson.service";

import type { Job } from "bullmq";
import type { QuizAttemptExpirationJobData } from "src/queue";

/** Finalizes timed quiz attempts the learner abandoned, using their last saved draft. */
@Injectable()
export class QuizAttemptExpirationWorker implements OnModuleDestroy {
  private readonly logger = new Logger(QuizAttemptExpirationWorker.name);
  private readonly worker: Worker<QuizAttemptExpirationJobData>;

  constructor(
    queueService: QueueService,
    private readonly lessonService: LessonService,
    private readonly tenantDbRunnerService: TenantDbRunnerService,
  ) {
    this.worker = new Worker<QuizAttemptExpirationJobData>(
      QUEUE_NAMES.QUIZ_ATTEMPT_EXPIRATION,
      (job, token) => this.handleJob(job, token),
      { connection: queueService.getConnection() },
    );

    this.worker.on("failed", (job, error) => {
      this.logger.error(`Quiz attempt expiration job ${job?.id} failed: ${error.message}`);
    });
  }

  async handleJob(job: Job<QuizAttemptExpirationJobData>, token?: string) {
    if (job.name !== QUIZ_ATTEMPT_EXPIRATION_JOB_NAME)
      throw new Error(`Unexpected quiz attempt expiration job name: ${job.name}`);

    const finalization = await this.tenantDbRunnerService.runWithTenant(job.data.tenantId, () =>
      this.lessonService.finalizeExpiredQuizAttempt(job.data.attemptId, job.data.actor),
    );

    await match(finalization)
      .with({ status: QUIZ_ATTEMPT_FINALIZATION_STATUSES.CLOSED }, async () => undefined)
      .with({ status: QUIZ_ATTEMPT_FINALIZATION_STATUSES.NOT_EXPIRED }, async (pending) => {
        // Fired early (clock skew between Redis and the database): wait for the grace period.
        await job.moveToDelayed(Date.now() + pending.msUntilGraceEnds + 1000, token);
        throw new DelayedError();
      })
      .exhaustive();
  }

  async onModuleDestroy() {
    await this.worker.close();
  }
}
