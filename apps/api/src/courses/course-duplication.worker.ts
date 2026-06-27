import {
  Injectable,
  InternalServerErrorException,
  Logger,
  type OnModuleDestroy,
} from "@nestjs/common";
import { Worker } from "bullmq";

import { COURSE_DUPLICATION_JOB_NAME } from "src/courses/course-duplication.queue.service";
import { CourseDuplicationService } from "src/courses/course-duplication.service";
import { QUEUE_NAMES, QueueService } from "src/queue";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import type { Job } from "bullmq";
import type { CourseDuplicationJobData } from "src/queue";

@Injectable()
export class CourseDuplicationWorker implements OnModuleDestroy {
  private readonly logger = new Logger(CourseDuplicationWorker.name);
  private readonly worker: Worker<CourseDuplicationJobData>;

  constructor(
    private readonly queueService: QueueService,
    private readonly courseDuplicationService: CourseDuplicationService,
    private readonly tenantDbRunnerService: TenantDbRunnerService,
  ) {
    this.worker = new Worker<CourseDuplicationJobData>(
      QUEUE_NAMES.COURSE_DUPLICATION,
      (job) => this.handleCourseDuplication(job),
      {
        connection: this.queueService.getConnection(),
        concurrency: Number(process.env.COURSE_DUPLICATION_WORKER_CONCURRENCY || 1),
      },
    );

    this.worker.on("failed", (job, err) => {
      this.logger.error(`Course duplication job ${job?.id} failed: ${err.message}`);
    });
  }

  private async handleCourseDuplication(job: Job<CourseDuplicationJobData>): Promise<void> {
    if (job.name !== COURSE_DUPLICATION_JOB_NAME) {
      throw new InternalServerErrorException(`Unexpected course duplication job name: ${job.name}`);
    }

    await this.tenantDbRunnerService.runWithTenant(job.data.tenantId, () =>
      this.courseDuplicationService.processDuplicationJob(String(job.id), job.data),
    );
  }

  async onModuleDestroy() {
    await this.worker.close();
  }
}
