/** Replays private draft events and discards inactive sessions under tenant scope. */
import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import { isAxiosError } from "axios";
import { v5 as uuidv5 } from "uuid";

import { QueueService } from "src/queue";
import { S3Service } from "src/s3/s3.service";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import { CourseAuthoringApplicationRepository } from "./course-authoring-application.repository";
import { enqueueAuthoringAutonomousEvent } from "./course-authoring-autonomous-event";
import { CourseAuthoringDraftRepository } from "./course-authoring-draft.repository";
import { LumaService } from "./luma.service";
import { authoringEventsSchema } from "./schema/course-authoring-session.schema";

const DRAFT_IDLE_MS = 60 * 60 * 1000;
const DRAFT_DISCARD_NAMESPACE = "2f5bfbf8-2f22-4706-9c04-1ad6545fc098";
const ACTIVE_TASK_STATUSES = new Set(["queued", "running", "waiting_dependencies"]);

type Draft = Awaited<ReturnType<CourseAuthoringDraftRepository["inactive"]>>[number];

const draftActivitySchema = Type.Object({
  sessionId: Type.String({ format: "uuid" }),
  courseId: Type.String({ format: "uuid" }),
  status: Type.String(),
  pendingWork: Type.Optional(Type.Boolean()),
  tasks: Type.Array(Type.Object({ status: Type.String() })),
});

@Injectable()
export class CourseAuthoringDraftLifecycleService {
  private readonly logger = new Logger(CourseAuthoringDraftLifecycleService.name);
  private polling = false;
  private sweeping = false;

  constructor(
    private readonly courseAuthoringDraftRepository: CourseAuthoringDraftRepository,
    private readonly courseAuthoringApplicationRepository: CourseAuthoringApplicationRepository,
    private readonly tenantDbRunnerService: TenantDbRunnerService,
    private readonly queueService: QueueService,
    private readonly lumaService: LumaService,
    private readonly s3Service: S3Service,
  ) {}

  /** Makes unattended draft approvals independent of browser connections. */
  @Cron(CronExpression.EVERY_10_SECONDS)
  async pollDraftEvents() {
    if (this.polling) return;
    this.polling = true;
    try {
      await this.runForEachTenant(async (tenantId) => {
        for (const draft of await this.courseAuthoringDraftRepository.pollable(tenantId, 50)) {
          try {
            await this.pollDraft(draft);
          } catch {
            this.logger.warn("An AI course draft event page will be replayed on the next poll");
            await this.courseAuthoringDraftRepository.markPolled(
              tenantId,
              draft.id,
              draft.cursorSequence,
              draft.cursorSequence,
            );
          }
        }
      });
    } finally {
      this.polling = false;
    }
  }

  /** Verifies contiguous producer events and commits the cursor after durable queue handoff. */
  private async pollDraft(draft: Draft) {
    const sessionId = draft.lumaSessionId;
    if (!sessionId) return;
    const client = await this.lumaService.getLumaClient();
    const page = await client.authoring.getEvents({
      sessionId,
      afterSequence: draft.cursorSequence,
      limit: 100,
    });
    if (!Value.Check(authoringEventsSchema.properties.data, page))
      throw new Error("Invalid draft event page");
    let cursor = draft.cursorSequence;
    for (const event of page.events) {
      if (event.sessionId !== sessionId || event.sequence !== cursor + 1)
        throw new Error("Invalid draft event sequence");
      await enqueueAuthoringAutonomousEvent(
        this.queueService,
        { sessionId, courseId: draft.id, tenantId: draft.tenantId, ownerId: draft.ownerId },
        event,
      );
      cursor = event.sequence;
    }
    await this.courseAuthoringDraftRepository.markPolled(
      draft.tenantId,
      draft.id,
      draft.cursorSequence,
      cursor,
    );
  }

  /** Expires inactive owner-only drafts and retries recoverable cleanup failures. */
  @Cron(CronExpression.EVERY_HOUR)
  async discardInactiveDrafts() {
    if (this.sweeping) return;
    this.sweeping = true;
    const before = new Date(Date.now() - DRAFT_IDLE_MS);
    try {
      await this.runForEachTenant(async (tenantId) => {
        for (const draft of await this.courseAuthoringDraftRepository.inactive(tenantId, before)) {
          try {
            await this.discardDraft(draft, before);
          } catch {
            this.logger.warn("An inactive AI course draft cleanup will retry on the next sweep");
          }
        }
      });
    } finally {
      this.sweeping = false;
    }
  }

  /** Checks producer work before fencing the draft and deleting its unapplied Core objects. */
  private async discardDraft(draft: Draft, before: Date) {
    const { tenantId, id, lumaSessionId, ownerId } = draft;
    let producerState: "missing" | "owned" | "unverified" = "missing";
    const client = lumaSessionId ? await this.lumaService.getLumaClient() : null;
    if (client && lumaSessionId) {
      try {
        const snapshot: unknown = await client.authoring.getSession({ sessionId: lumaSessionId });
        if (
          !Value.Check(draftActivitySchema, snapshot) ||
          snapshot.sessionId !== lumaSessionId ||
          snapshot.courseId !== id
        ) {
          producerState = "unverified";
        } else if (snapshot.status !== "discarded") {
          producerState = "owned";
          if (
            !draft.expiredAt &&
            (snapshot.pendingWork ||
              snapshot.tasks.some((task) => ACTIVE_TASK_STATUSES.has(task.status)))
          ) {
            await this.courseAuthoringDraftRepository.touch(tenantId, id, lumaSessionId);
            return;
          }
        }
      } catch (error) {
        if (!isAxiosError(error) || error.response?.status !== 404) throw error;
      }
    }

    if (!(await this.courseAuthoringDraftRepository.expire(tenantId, id, before))) return;
    if (producerState === "owned" && client && lumaSessionId) {
      try {
        await client.authoring.sendCommand({
          sessionId: lumaSessionId,
          command: {
            schemaVersion: 1,
            commandId: uuidv5(id, DRAFT_DISCARD_NAMESPACE),
            actorId: ownerId,
            action: "draft.discard",
          },
        });
      } catch (error) {
        if (
          !isAxiosError(error) ||
          (error.response?.status !== 404 &&
            !(
              error.response?.status === 409 &&
              error.response.data?.detail === "AUTHORING_DRAFT_DISCARDED"
            ))
        ) {
          throw error;
        }
      }
    }
    if (producerState === "unverified") {
      // The orphan-staging sweep can reclaim aged assets without trusting the session binding.
      this.logger.warn("Retiring an inactive AI course draft with an invalid producer snapshot");
    } else if (lumaSessionId) {
      const assets = await this.courseAuthoringApplicationRepository.draftStagedAssets(
        tenantId,
        lumaSessionId,
      );
      const now = new Date();
      for (const asset of assets) {
        await this.courseAuthoringApplicationRepository.cleanExpiredStagedAsset(
          tenantId,
          asset.id,
          now,
          (key) => this.s3Service.deleteFile(key),
        );
      }
    }
    await this.courseAuthoringDraftRepository.markDiscarded(tenantId, id);
  }

  /** Keeps one tenant failure from blocking unrelated sessions and tenants. */
  private async runForEachTenant(run: (tenantId: string) => Promise<void>) {
    try {
      await this.tenantDbRunnerService.runForEachTenant(async (tenantId) => {
        try {
          await run(tenantId);
        } catch {
          this.logger.warn("A tenant AI course draft scan will retry on the next interval");
        }
      });
    } catch {
      this.logger.warn("AI course draft scan will retry on the next interval");
    }
  }
}
