import { Injectable, Logger, type OnModuleDestroy } from "@nestjs/common";
import { Worker } from "bullmq";

import { AI_JUDGE_GENERATION_FAILURE_MESSAGE } from "src/ai/judge-configuration-generation/ai-judge-configuration-generation.constants";
import { AI_JUDGE_GENERATION_STATUS } from "src/ai/judge-configuration-generation/ai-judge-configuration-generation.types";
import { QUEUE_NAMES, QueueService } from "src/queue";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import { AiJudgeConfigurationGenerationQueueService } from "./ai-judge-configuration-generation-queue.service";
import {
  AI_JUDGE_CONFIGURATION_GENERATION_JOB_NAME,
  AI_JUDGE_CONFIGURATION_GENERATION_WORKER_CONCURRENCY,
} from "./ai-judge-configuration-generation.constants";
import { AiJudgeConfigurationGenerationService } from "./ai-judge-configuration-generation.service";

import type { AiJudgeConfigurationGenerationJobData } from "./ai-judge-configuration-generation.types";
import type { Job } from "bullmq";
import type { AiJudgeGenerationApplicationProgressEvent } from "src/ai/judge-configuration-generation/schemas/ai-judge-configuration-generation.schema";

@Injectable()
export class AiJudgeConfigurationGenerationWorker implements OnModuleDestroy {
  private readonly logger = new Logger(AiJudgeConfigurationGenerationWorker.name);
  private readonly worker: Worker<AiJudgeConfigurationGenerationJobData>;

  constructor(
    globalQueueService: QueueService,
    private readonly aiJudgeConfigurationGenerationService: AiJudgeConfigurationGenerationService,
    private readonly aiJudgeConfigurationGenerationQueueService: AiJudgeConfigurationGenerationQueueService,
    private readonly tenantDbRunnerService: TenantDbRunnerService,
  ) {
    this.worker = new Worker<AiJudgeConfigurationGenerationJobData>(
      QUEUE_NAMES.AI_JUDGE_CONFIGURATION_GENERATION,
      (job) => this.handleJob(job),
      {
        connection: globalQueueService.getConnection(),
        concurrency: AI_JUDGE_CONFIGURATION_GENERATION_WORKER_CONCURRENCY,
      },
    );

    this.worker.on("failed", (job, error) => {
      this.logger.error(
        `AI Judge configuration generation job ${job?.id} failed: ${error.message}`,
      );
    });
  }

  private async handleJob(job: Job<AiJudgeConfigurationGenerationJobData>) {
    if (job.name !== AI_JUDGE_CONFIGURATION_GENERATION_JOB_NAME)
      throw new Error(`Unexpected AI Judge configuration generation job name: ${job.name}`);

    return this.tenantDbRunnerService.runWithTenant(job.data.tenantId, () => this.process(job));
  }

  private async process(job: Job<AiJudgeConfigurationGenerationJobData>) {
    try {
      return await this.aiJudgeConfigurationGenerationService.execute(job.data.prepared, {
        isCancelled: () =>
          this.aiJudgeConfigurationGenerationQueueService.isCancellationRequested(job.id),
        onReferencedDraft: (draft) =>
          this.aiJudgeConfigurationGenerationQueueService.storeReferencedDraft(job, draft),
        reportProgress: (progress) =>
          this.aiJudgeConfigurationGenerationQueueService.publishProgress(job, progress),
      });
    } catch (error) {
      const currentProgress = this.aiJudgeConfigurationGenerationQueueService.getProgress(job);
      const failedProgress: AiJudgeGenerationApplicationProgressEvent = {
        status: AI_JUDGE_GENERATION_STATUS.FAILED,
        attempt: currentProgress.attempt,
        attemptHistory: currentProgress.attemptHistory,
        message: AI_JUDGE_GENERATION_FAILURE_MESSAGE,
      };
      await this.aiJudgeConfigurationGenerationQueueService.publishProgress(job, failedProgress);
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.worker.close();
  }
}
