/** Fulfills selected context requests using freshly authorized native Core data. */
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { UnrecoverableError, Worker } from "bullmq";
import { and, eq, isNull } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { QUEUE_NAMES, QueueService } from "src/queue";
import { DB } from "src/storage/db/db.providers";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";
import { users } from "src/storage/schema";

import { CourseAuthoringContextBridgeRepository } from "./course-authoring-context-bridge.repository";
import { CourseAuthoringContextBridgeService } from "./course-authoring-context-bridge.service";
import { CourseAuthoringContextService } from "./course-authoring-context.service";
import { LumaService } from "./luma.service";

import type {
  CourseAuthoringContextFailure,
  CourseAuthoringContextRequest,
  CourseAuthoringContextResponse,
} from "./course-authoring-context-bridge.types";
import type { OnModuleDestroy } from "@nestjs/common";
import type { CourseAuthoringContextFulfillmentJob } from "src/queue/queue.types";

type ContextFailureReason = CourseAuthoringContextFailure["reasonCode"];

class ContextRequestRejectedError extends Error {
  constructor(readonly reasonCode: ContextFailureReason) {
    super(reasonCode);
  }
}

@Injectable()
export class CourseAuthoringContextBridgeWorker implements OnModuleDestroy {
  private readonly logger = new Logger(CourseAuthoringContextBridgeWorker.name);
  private readonly worker: Worker<CourseAuthoringContextFulfillmentJob>;

  constructor(
    queue: QueueService,
    tenants: TenantDbRunnerService,
    private readonly repository: CourseAuthoringContextBridgeRepository,
    private readonly context: CourseAuthoringContextService,
    private readonly luma: LumaService,
    @Inject(DB) private readonly db: DatabasePg,
  ) {
    this.worker = new Worker<CourseAuthoringContextFulfillmentJob>(
      QUEUE_NAMES.COURSE_AUTHORING_CONTEXT,
      (job) => this.handleJob(job.data, tenants),
      { connection: queue.getConnection(), concurrency: 4 },
    );
    this.worker.on("error", () =>
      this.logger.error("Course authoring context worker connection failed"),
    );
  }

  async handleJob(job: CourseAuthoringContextFulfillmentJob, tenants: TenantDbRunnerService) {
    try {
      return await tenants.runWithTenant(job.tenantId, () => this.fulfill(job));
    } catch (error) {
      const reasonCode = this.failureReason(error);
      if (!reasonCode) throw error;
      const row = await this.repository.findRequest(job.tenantId, job.contextRequestId);
      if (row?.request.status === "pending") {
        await this.sendFailure(row.request.payload as CourseAuthoringContextRequest, reasonCode);
        await this.repository.markFailed(job.tenantId, job.contextRequestId, reasonCode);
      }
      throw new UnrecoverableError(error instanceof Error ? error.message : reasonCode);
    }
  }

  private failureReason(error: unknown): ContextFailureReason | undefined {
    if (error instanceof ContextRequestRejectedError) return error.reasonCode;
    if (error instanceof ForbiddenException) return "permission_revoked";
    if (error instanceof NotFoundException) return "course_unavailable";
    if (error instanceof BadRequestException) return "target_unavailable";
    return undefined;
  }

  private async sendFailure(
    request: CourseAuthoringContextRequest,
    reasonCode: ContextFailureReason,
  ) {
    const failureWithoutHash = {
      schemaVersion: 1 as const,
      contextRequestId: request.contextRequestId,
      sessionId: request.sessionId,
      requestId: request.requestId,
      taskId: request.taskId,
      taskFence: request.taskFence,
      reasonCode,
    };
    const failure: CourseAuthoringContextFailure = {
      ...failureWithoutHash,
      failureHash: CourseAuthoringContextBridgeService.failureHash(failureWithoutHash),
    };
    const client = await this.luma.getLumaClient();
    await client.authoring.failContext({
      sessionId: request.sessionId,
      contextRequestId: request.contextRequestId,
      failure,
    });
  }

  private async fulfill(job: CourseAuthoringContextFulfillmentJob) {
    const row = await this.repository.findRequest(job.tenantId, job.contextRequestId);
    if (!row || row.request.status !== "pending") return;
    const request = row.request.payload as CourseAuthoringContextRequest;
    const binding = row.binding;
    if (
      request.sessionId !== binding.sessionId ||
      request.courseId !== binding.courseId ||
      request.language !== binding.language ||
      request.contextRequestId !== job.contextRequestId
    ) {
      throw new ContextRequestRejectedError("context_invalid");
    }

    const [user] = await this.db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(
        and(
          eq(users.id, binding.actorId),
          eq(users.tenantId, binding.tenantId),
          isNull(users.deletedAt),
          eq(users.archived, false),
        ),
      );
    if (!user) {
      throw new ContextRequestRejectedError("permission_revoked");
    }
    const actor = {
      userId: user.id,
      email: user.email,
      tenantId: binding.tenantId,
      roleSlugs: [],
      permissions: [],
    };

    // The skeleton provides structural baselines; detail is loaded separately for selected lessons only.
    const skeleton = await this.context.getContext(
      binding.courseId,
      { language: binding.language },
      actor,
    );
    const selected = request.lessonIds.length
      ? await this.context.getSelectedLessonDetails(
          binding.courseId,
          binding.language,
          request.lessonIds,
          actor,
        )
      : { courseId: binding.courseId, language: binding.language, chapters: [] };
    const selectedByChapter = new Map(
      selected.chapters.map((chapter) => [chapter.id, chapter.lessons]),
    );
    const selectedChapterIds = new Set(selectedByChapter.keys());
    const chapters = skeleton.chapters
      .filter((chapter) => selectedChapterIds.has(chapter.id))
      .map((chapter) => ({
        id: chapter.id,
        title: chapter.title,
        displayOrder: chapter.displayOrder,
        baselineHash: chapter.baselineHash,
        deletionBaselineHash: chapter.deletionBaselineHash,
        lessons: (selectedByChapter.get(chapter.id) ?? []).map((lesson) => {
          const structuralLesson = chapter.lessons.find((item) => item.id === lesson.id);
          if (!structuralLesson)
            throw new BadRequestException("courseAuthoring.errors.targetOutsideCourse");
          return { ...lesson, baselineHash: structuralLesson.baselineHash };
        }),
      }));

    const responseWithoutHash = {
      schemaVersion: 1 as const,
      contextRequestId: request.contextRequestId,
      sessionId: request.sessionId,
      requestId: request.requestId,
      taskId: request.taskId,
      taskFence: request.taskFence,
      courseId: request.courseId,
      language: request.language,
      courseBaselineHash: skeleton.baselineHash,
      chapters,
    };
    const response = {
      ...responseWithoutHash,
      responseHash: CourseAuthoringContextBridgeService.responseHash(responseWithoutHash),
    } as CourseAuthoringContextResponse;
    const client = await this.luma.getLumaClient();
    await client.authoring.fulfillContext({
      sessionId: request.sessionId,
      contextRequestId: request.contextRequestId,
      response,
    });
    await this.repository.markFulfilled(job.tenantId, job.contextRequestId);
  }

  async onModuleDestroy() {
    await this.worker.close();
  }
}
