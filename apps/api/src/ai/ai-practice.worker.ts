import {
  Injectable,
  InternalServerErrorException,
  Logger,
  type OnModuleDestroy,
} from "@nestjs/common";
import { Worker } from "bullmq";

import { AI_MENTOR_PRACTICE_JOB_NAME } from "src/ai/ai-practice.queue.service";
import { AiPracticeService } from "src/ai/services/ai-practice.service";
import { QUEUE_NAMES, QueueService } from "src/queue";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import type { Job } from "bullmq";
import type { AiMentorPracticeJobData } from "src/ai/ai-practice.types";

@Injectable()
export class AiPracticeWorker implements OnModuleDestroy {
  private readonly logger = new Logger(AiPracticeWorker.name);
  private readonly worker: Worker<AiMentorPracticeJobData>;

  constructor(
    private readonly queueService: QueueService,
    private readonly practiceService: AiPracticeService,
    private readonly tenantRunner: TenantDbRunnerService,
  ) {
    this.worker = new Worker<AiMentorPracticeJobData>(
      QUEUE_NAMES.AI_MENTOR_PRACTICE,
      (job) => this.process(job),
      {
        connection: this.queueService.getConnection(),
        concurrency: Number(process.env.AI_MENTOR_PRACTICE_WORKER_CONCURRENCY || 2),
      },
    );
    this.worker.on("failed", (job, error) => {
      this.logger.error(`AI Mentor practice job ${job?.id} failed: ${error.message}`);
    });
  }

  private async process(job: Job<AiMentorPracticeJobData>) {
    if (job.name !== AI_MENTOR_PRACTICE_JOB_NAME)
      throw new InternalServerErrorException(`Unexpected AI practice job name: ${job.name}`);

    await this.tenantRunner.runWithTenant(job.data.tenantId, () =>
      this.practiceService.processGenerationJob(job.data),
    );
  }

  async onModuleDestroy() {
    await this.worker.close();
  }
}
