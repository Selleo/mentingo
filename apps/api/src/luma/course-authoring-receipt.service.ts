/** Retries durable application receipt delivery after native writes have committed. */
import { ConflictException, Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

import { QUEUE_NAMES, QueueService } from "src/queue";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import { CourseAuthoringApplicationRepository } from "./course-authoring-application.repository";
import { LumaService } from "./luma.service";

import type { CourseAuthoringReceiptJob } from "./course-authoring.types";

@Injectable()
/** Publishes committed native receipts and retries delivery without repeating native writes. */
export class CourseAuthoringReceiptService {
  private readonly logger = new Logger(CourseAuthoringReceiptService.name);
  private scanning = false;
  /** Injects receipt persistence, producer delivery, queueing, and tenant iteration. */
  constructor(
    private readonly receipts: CourseAuthoringApplicationRepository,
    private readonly luma: LumaService,
    private readonly queue: QueueService,
    private readonly tenants: TenantDbRunnerService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  /** Scans each tenant for undelivered receipts and enqueues stable retry jobs. */
  async enqueuePendingReceipts() {
    if (this.scanning) return;
    this.scanning = true;
    try {
      await this.tenants.runForEachTenant(async (tenantId) => {
        try {
          for (const receipt of await this.receipts.pendingReceipts(tenantId)) {
            await this.queue.enqueue<CourseAuthoringReceiptJob>(
              QUEUE_NAMES.COURSE_AUTHORING_APPLY,
              "receipt",
              { ...receipt, tenantId },
              {
                jobId: `receipt-${tenantId}-${receipt.exportId}`,
                attempts: 5,
                backoff: { type: "exponential", delay: 1000 },
                removeOnComplete: true,
                removeOnFail: true,
              },
            );
          }
        } catch {
          this.logger.warn("A tenant receipt scan will retry on the next interval");
        }
      });
    } catch {
      this.logger.warn("Course authoring receipt scan will retry on the next interval");
    } finally {
      this.scanning = false;
    }
  }

  /** Delivers one matching receipt to the authoring service and marks it complete. */
  async deliver(data: CourseAuthoringReceiptJob) {
    const receipt = await this.receipts.findReceipt(data.courseId, data.exportId, data.tenantId);
    if (!receipt) return;
    if (receipt.sessionId !== data.sessionId || receipt.exportHash !== data.exportHash)
      throw new ConflictException("courseAuthoring.errors.exportIdentityConflict");
    const client = await this.luma.getLumaClient();
    await client.authoring.recordReceipt({
      sessionId: data.sessionId,
      receipt: {
        courseId: data.courseId,
        sessionId: data.sessionId,
        applicationId: receipt.applicationId,
        exportId: data.exportId,
        exportHash: data.exportHash,
        status: "applied",
        idMappings: receipt.entityMappings,
        reason: null,
      },
    });
    await this.receipts.markDelivered(data.tenantId, data.exportId, data.exportHash);
  }
}
