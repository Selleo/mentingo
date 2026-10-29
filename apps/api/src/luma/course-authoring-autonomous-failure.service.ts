/** Reconciles exhausted autonomous handoffs into durable, sanitized producer outcomes. */
import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

import { QUEUE_NAMES, QueueService } from "src/queue";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import { LumaService } from "./luma.service";

import type { CourseAuthoringAutonomousApplyJob } from "src/queue/queue.types";

@Injectable()
export class CourseAuthoringAutonomousFailureService {
  private readonly logger = new Logger(CourseAuthoringAutonomousFailureService.name);
  private readonly scanOffsets = new Map<string, number>();
  private scanning = false;

  constructor(
    private readonly queueService: QueueService,
    private readonly tenantDbRunnerService: TenantDbRunnerService,
    private readonly lumaService: LumaService,
  ) {}

  /** The retained failed job is the recovery record until the producer acknowledges it. */
  @Cron(CronExpression.EVERY_MINUTE)
  async reconcileFailedHandoffs() {
    if (this.scanning) return;
    this.scanning = true;
    try {
      await this.tenantDbRunnerService.runForEachTenant(async (tenantId) => {
        try {
          await this.tenantDbRunnerService.runWithTenant(tenantId, async () => {
            const offset = this.scanOffsets.get(tenantId) ?? 0;
            const jobs = await this.queueService
              .getQueue(QUEUE_NAMES.COURSE_AUTHORING_AUTONOMOUS)
              .getJobs(["failed"], offset, offset + 99);
            for (const job of jobs) {
              const data = job.data as CourseAuthoringAutonomousApplyJob;
              if (
                data.tenantId !== tenantId ||
                data.failureReported ||
                (await job.getState()) !== "failed"
              )
                continue;
              try {
                const client = await this.lumaService.getLumaClient();
                const command = {
                  schemaVersion: 1 as const,
                  commandId: data.eventId,
                  actorId: data.actorId,
                  action: "autonomous.fail" as const,
                  targetId: data.requestId,
                  expectedRevision: data.controlEpoch,
                };
                await client.authoring.sendCommand({
                  sessionId: data.sessionId,
                  command: command as unknown as Parameters<
                    typeof client.authoring.sendCommand
                  >[0]["command"],
                });
                // A crash before this write only causes an idempotent re-delivery.
                await job.updateData({ ...data, failureReported: true });
              } catch {
                this.logger.warn("An autonomous handoff outcome will retry on a later scan");
              }
            }
            this.scanOffsets.set(tenantId, jobs.length === 100 ? offset + 100 : 0);
          });
        } catch {
          this.logger.warn("A tenant autonomous outcome scan will retry on the next interval");
        }
      });
    } catch {
      this.logger.warn("Autonomous outcome scan will retry on the next interval");
    } finally {
      this.scanning = false;
    }
  }
}
