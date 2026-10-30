/** Handles durable producer requests for fenced, unattended export application. */
import { ForbiddenException, Inject, Injectable, Logger } from "@nestjs/common";
import { Worker } from "bullmq";
import { and, eq, isNull } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { QUEUE_NAMES, QueueService } from "src/queue";
import { DB } from "src/storage/db/db.providers";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";
import { users } from "src/storage/schema";

import { CourseAuthoringApplicationService } from "./course-authoring-application.service";
import { CourseAuthoringContextService } from "./course-authoring-context.service";

import type { OnModuleDestroy } from "@nestjs/common";
import type { CourseAuthoringAutonomousApplyJob } from "src/queue/queue.types";

@Injectable()
export class CourseAuthoringAutonomousWorker implements OnModuleDestroy {
  private readonly logger = new Logger(CourseAuthoringAutonomousWorker.name);
  private readonly worker: Worker<CourseAuthoringAutonomousApplyJob>;

  constructor(
    queue: QueueService,
    tenants: TenantDbRunnerService,
    private readonly courseAuthoringApplicationService: CourseAuthoringApplicationService,
    private readonly courseAuthoringContextService: CourseAuthoringContextService,
    @Inject(DB) private readonly db: DatabasePg,
  ) {
    this.worker = new Worker<CourseAuthoringAutonomousApplyJob>(
      QUEUE_NAMES.COURSE_AUTHORING_AUTONOMOUS,
      (job) => this.handleJob(job.data, tenants),
      { connection: queue.getConnection(), concurrency: 2 },
    );
    this.worker.on("error", () =>
      this.logger.error("Autonomous authoring worker connection failed"),
    );
    this.worker.on("failed", (job) =>
      this.logger.warn(`Autonomous authoring job failed eventId=${job?.data.eventId ?? "unknown"}`),
    );
  }

  async handleJob(job: CourseAuthoringAutonomousApplyJob, tenants: TenantDbRunnerService) {
    return tenants.runWithTenant(job.tenantId, async () => {
      const [user] = await this.db
        .select({ id: users.id, email: users.email })
        .from(users)
        .where(
          and(
            eq(users.id, job.actorId),
            eq(users.tenantId, job.tenantId),
            isNull(users.deletedAt),
            eq(users.archived, false),
          ),
        );
      if (!user) throw new ForbiddenException("common.toast.noAccess");
      const actor = await this.courseAuthoringContextService.authorize(job.courseId, {
        userId: user.id,
        email: user.email,
        tenantId: job.tenantId,
        roleSlugs: [],
        permissions: [],
      });
      return this.courseAuthoringApplicationService.enqueue(
        job.courseId,
        job.sessionId,
        { commandId: job.eventId, proposalIds: job.proposalIds },
        actor,
        { requestId: job.requestId, controlEpoch: job.controlEpoch },
      );
    });
  }

  async onModuleDestroy() {
    await this.worker.close();
  }
}
