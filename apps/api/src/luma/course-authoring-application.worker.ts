/** Runs queued authoring application and receipt-delivery jobs under tenant scope. */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Logger,
  Injectable,
} from "@nestjs/common";
import { UnrecoverableError, Worker } from "bullmq";

import { QUEUE_NAMES, QueueService } from "src/queue";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import { CourseAuthoringApplicationService } from "./course-authoring-application.service";
import { CourseAuthoringReceiptService } from "./course-authoring-receipt.service";

import type { CourseAuthoringApplyJob, CourseAuthoringReceiptJob } from "./course-authoring.types";
import type { OnModuleDestroy } from "@nestjs/common";

@Injectable()
/** Consumes application jobs and converts permanent domain errors into non-retryable failures. */
export class CourseAuthoringApplicationWorker implements OnModuleDestroy {
  private readonly logger = new Logger(CourseAuthoringApplicationWorker.name);
  private readonly worker: Worker<CourseAuthoringApplyJob | CourseAuthoringReceiptJob>;
  /** Builds the BullMQ consumer with tenant runners and retry-aware services. */
  constructor(
    queue: QueueService,
    tenants: TenantDbRunnerService,
    applications: CourseAuthoringApplicationService,
    receipts: CourseAuthoringReceiptService,
  ) {
    this.worker = new Worker<CourseAuthoringApplyJob | CourseAuthoringReceiptJob>(
      QUEUE_NAMES.COURSE_AUTHORING_APPLY,
      async (job) => {
        try {
          const data = job.data;
          if ("actor" in data)
            return await tenants.runWithTenant(data.actor.tenantId, () =>
              applications.process(data),
            );
          return await tenants.runWithTenant(data.tenantId, () => receipts.deliver(data));
        } catch (error) {
          const permanent =
            error instanceof BadRequestException ||
            error instanceof ConflictException ||
            error instanceof ForbiddenException;
          if (
            "actor" in job.data &&
            (permanent || job.attemptsMade + 1 >= (job.opts.attempts ?? 1))
          )
            await tenants.runWithTenant(job.data.actor.tenantId, () =>
              applications.recordTerminalFailure(
                job.data as CourseAuthoringApplyJob,
                error instanceof Error ? error.message : "courseAuthoring.errors.applicationFailed",
              ),
            );
          if (permanent) throw new UnrecoverableError(error.message);
          throw error;
        }
      },
      { connection: queue.getConnection(), concurrency: 2 },
    );
    // BullMQ emits infrastructure errors independently of the job failure promise.
    this.worker.on("error", () =>
      this.logger.error("Course authoring application worker connection failed"),
    );
  }
  /** Closes the BullMQ worker during module shutdown. */
  async onModuleDestroy() {
    await this.worker.close();
  }
}
