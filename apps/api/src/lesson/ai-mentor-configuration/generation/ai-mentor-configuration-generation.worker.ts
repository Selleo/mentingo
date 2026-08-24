import { Injectable, Logger, type OnModuleDestroy } from "@nestjs/common";
import { AI_MENTOR_CONFIGURATION_GENERATION_STATUS } from "@repo/shared";
import { Worker } from "bullmq";

import { AI_MENTOR_CONFIGURATION_GENERATION_FAILURE_MESSAGE } from "src/ai/mentor-configuration-generation/ai-mentor-configuration-generation.constants";
import { QUEUE_NAMES, QueueService } from "src/queue";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import { AiMentorConfigurationGenerationQueueService } from "./ai-mentor-configuration-generation-queue.service";
import {
  AI_MENTOR_CONFIGURATION_GENERATION_JOB_NAME,
  AI_MENTOR_CONFIGURATION_GENERATION_WORKER_CONCURRENCY,
} from "./ai-mentor-configuration-generation.constants";
import { AiMentorConfigurationGenerationService } from "./ai-mentor-configuration-generation.service";

import type { AiMentorConfigurationGenerationJobData } from "./ai-mentor-configuration-generation.types";
import type { Job } from "bullmq";
import type { AiMentorConfigurationGenerationProgressEvent } from "src/ai/mentor-configuration-generation/schemas/ai-mentor-configuration-generation.schema";

@Injectable()
export class AiMentorConfigurationGenerationWorker implements OnModuleDestroy {
  private readonly logger = new Logger(AiMentorConfigurationGenerationWorker.name);
  private readonly worker: Worker<AiMentorConfigurationGenerationJobData>;

  constructor(
    globalQueueService: QueueService,
    private readonly generationService: AiMentorConfigurationGenerationService,
    private readonly queueService: AiMentorConfigurationGenerationQueueService,
    private readonly tenantDbRunnerService: TenantDbRunnerService,
  ) {
    this.worker = new Worker<AiMentorConfigurationGenerationJobData>(
      QUEUE_NAMES.AI_MENTOR_CONFIGURATION_GENERATION,
      (job) => this.handleJob(job),
      {
        connection: globalQueueService.getConnection(),
        concurrency: AI_MENTOR_CONFIGURATION_GENERATION_WORKER_CONCURRENCY,
      },
    );
    this.worker.on("failed", (job, error) => {
      this.logger.error(
        `AI Mentor configuration generation job ${job?.id} failed: ${error.message}`,
      );
    });
  }

  private async handleJob(job: Job<AiMentorConfigurationGenerationJobData>) {
    if (job.name !== AI_MENTOR_CONFIGURATION_GENERATION_JOB_NAME)
      throw new Error(`Unexpected AI Mentor configuration generation job name: ${job.name}`);

    return this.tenantDbRunnerService.runWithTenant(job.data.tenantId, () => this.process(job));
  }

  private async process(job: Job<AiMentorConfigurationGenerationJobData>) {
    try {
      return await this.generationService.execute(job.data.prepared, {
        isCancelled: () => this.queueService.isCancellationRequested(job.id),
        onDraft: (draft) => this.queueService.storeLatestDraft(job, draft),
        reportProgress: (progress) => this.queueService.publishProgress(job, progress),
      });
    } catch (error) {
      const currentProgress = this.queueService.getProgress(job);
      const failedProgress: AiMentorConfigurationGenerationProgressEvent = {
        status: AI_MENTOR_CONFIGURATION_GENERATION_STATUS.FAILED,
        attempt: currentProgress.attempt,
        attemptHistory: currentProgress.attemptHistory,
        message: AI_MENTOR_CONFIGURATION_GENERATION_FAILURE_MESSAGE,
      };
      await this.queueService.publishProgress(job, failedProgress);
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.worker.close();
  }
}
