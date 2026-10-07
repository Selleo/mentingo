/** Validates frozen authoring exports, stages assets, and queues atomic native application work. */
import { createHash } from "node:crypto";
import { Readable } from "node:stream";

import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ALLOWED_LESSON_IMAGE_FILE_TYPES } from "@repo/shared";
import { Value } from "@sinclair/typebox/value";
import { isAxiosError } from "axios";
import { v5 as uuidv5 } from "uuid";

import { MAX_FILE_SIZE } from "src/file/file.constants";
import { FileGuard } from "src/file/guards/file.guard";
import { prefixTenantStorageKey } from "src/file/utils/tenantStorageKey";
import { IngestionProcessingService } from "src/ingestion/services/ingestion-processing.service";
import { QUEUE_NAMES, QueueService } from "src/queue";
import { S3Service } from "src/s3/s3.service";

import { CourseAuthoringApplicationRepository } from "./course-authoring-application.repository";
import { CourseAuthoringApplyService } from "./course-authoring-apply.service";
import { CourseAuthoringContextService } from "./course-authoring-context.service";
import { courseAuthoringExportHash } from "./course-authoring-export-hash";
import {
  buildMentorCourseContextDocument,
  mentorCourseContextKey,
  mentorTargetedContextKey,
} from "./course-authoring-mentor-context";
import { CourseAuthoringSessionService } from "./course-authoring-session.service";
import { LumaService } from "./luma.service";
import { frozenAuthoringExportSchema } from "./schema/course-authoring-application.schema";

import type { CourseAuthoringApplyJob, CourseAuthoringReceiptJob } from "./course-authoring.types";
import type { AuthoringApplyStatus } from "./schema/course-authoring-application.schema";
import type {
  AuthoringCommandBody,
  AuthoringCommandReceiptResponse,
  PrepareAuthoringExportBody,
} from "./schema/course-authoring-session.schema";
import type { CurrentUserType } from "src/common/types/current-user.type";

const AUTHORING_SELECTION_NAMESPACE = "d7c56648-dc67-4a51-9a91-c318311b10e7";

/** Identifies the immutable export contents independently of the editor and apply attempt. */
const selectionCommandId = (sessionId: string, proposalIds: string[], omittedAssetIds: string[]) =>
  uuidv5(
    JSON.stringify({
      sessionId,
      proposalIds: [...new Set(proposalIds)].sort(),
      omittedAssetIds: [...new Set(omittedAssetIds)].sort(),
    }),
    AUTHORING_SELECTION_NAMESPACE,
  );

@Injectable()
/** Coordinates export preparation, asset staging, queued application, and receipt handoff. */
export class CourseAuthoringApplicationService {
  /** Injects session, export, queue, storage, and native-apply collaborators. */
  constructor(
    private readonly sessions: CourseAuthoringSessionService,
    private readonly context: CourseAuthoringContextService,
    private readonly luma: LumaService,
    private readonly queue: QueueService,
    private readonly receipts: CourseAuthoringApplicationRepository,
    private readonly apply: CourseAuthoringApplyService,
    private readonly storage: S3Service,
    private readonly ingestion: IngestionProcessingService,
  ) {}

  /** Persists a proposal decision; the explicit applications endpoint owns export queueing. */
  async command(
    courseId: string,
    sessionId: string,
    input: AuthoringCommandBody,
    actor: CurrentUserType,
  ): Promise<AuthoringCommandReceiptResponse> {
    const receipt = await this.sessions.command(courseId, sessionId, input, actor);
    return receipt;
  }

  /** Validates access, prepares an export, and queues the tenant-scoped apply job. */
  async enqueue(
    courseId: string,
    sessionId: string,
    input: PrepareAuthoringExportBody,
    actor: CurrentUserType,
  ): Promise<AuthoringApplyStatus> {
    await this.sessions.get(courseId, sessionId, actor);
    const pendingReceipts = await this.receipts.pendingSessionReceipts(
      actor.tenantId,
      courseId,
      sessionId,
    );
    if (pendingReceipts.length) {
      for (const receipt of pendingReceipts)
        await this.queue.enqueue<CourseAuthoringReceiptJob>(
          QUEUE_NAMES.COURSE_AUTHORING_APPLY,
          "receipt",
          { ...receipt, tenantId: actor.tenantId },
          {
            jobId: `receipt-${actor.tenantId}-${receipt.exportId}`,
            attempts: 5,
            backoff: { type: "exponential", delay: 1000 },
            removeOnComplete: true,
            removeOnFail: true,
          },
        );
      throw new ConflictException("courseAuthoring.errors.receiptSynchronizationPending");
    }
    const client = await this.luma.getLumaClient();
    const proposalIds = [...new Set(input.proposalIds)].sort();
    const omitOptionalAssetIds = [...new Set(input.omitOptionalAssetIds ?? [])].sort();
    const commandId = selectionCommandId(sessionId, proposalIds, omitOptionalAssetIds);
    const exported = await client.authoring
      .prepareExport({
        sessionId,
        request: {
          commandId,
          proposalIds,
          ...(omitOptionalAssetIds.length ? { omitOptionalAssetIds } : {}),
          actorId: actor.userId,
        },
      })
      .catch((error: unknown) => {
        if (isAxiosError(error) && error.response?.status === 409) {
          const reason = error.response.data?.detail;
          if (reason === "AUTHORING_SELECTION_ALREADY_APPLIED")
            throw new ConflictException("courseAuthoring.errors.selectionAlreadyApplied");
          if (reason === "AUTHORING_IDEMPOTENCY_CONFLICT")
            throw new ConflictException("courseAuthoring.errors.exportIdentityConflict");
          const conflictMessages: Record<string, string> = {
            AUTHORING_PROPOSAL_NOT_ACCEPTED: "courseAuthoring.errors.proposalNotReady",
            AUTHORING_ASSET_NOT_READY: "courseAuthoring.errors.assetNotReady",
            AUTHORING_DEPENDENCY_UNREADY: "courseAuthoring.errors.missingDependency",
            AUTHORING_CHAPTER_DEPENDENCY_UNREADY: "courseAuthoring.errors.missingDependency",
            AUTHORING_OPERATION_CONFLICT: "courseAuthoring.errors.invalidOperations",
            AUTHORING_CLEANUP_COMMITTED: "courseAuthoring.errors.invalidCommand",
            AUTHORING_REQUIRED_ASSET_CANNOT_BE_OMITTED: "courseAuthoring.errors.invalidOperations",
            AUTHORING_OPTIONAL_ASSET_NOT_IN_SELECTION: "courseAuthoring.errors.invalidOperations",
            AUTHORING_ASSET_OMISSION_REQUIRES_SCOPE_CHANGE:
              "courseAuthoring.errors.invalidOperations",
          };
          throw new ConflictException(
            conflictMessages[reason] ?? "courseAuthoring.errors.invalidCommand",
          );
        }
        throw new BadGatewayException("adminCourseView.toast.lumaServiceUnavailable");
      });
    if (exported.courseId !== courseId || exported.sessionId !== sessionId)
      throw new BadGatewayException("courseAuthoring.errors.invalidServiceResponse");
    const queue = this.queue.getQueue(QUEUE_NAMES.COURSE_AUTHORING_APPLY);
    const jobId = `${actor.tenantId}-${exported.exportId}`;
    const existingJob = await queue.getJob(jobId);
    if (existingJob) {
      if (existingJob.data.courseId !== courseId || existingJob.data.sessionId !== sessionId)
        throw new ConflictException("courseAuthoring.errors.exportIdentityConflict");
      const state = await existingJob.getState();
      if (state !== "failed") return this.status(courseId, sessionId, exported.exportId, actor);
      if (existingJob.failedReason === "courseAuthoring.errors.baselineChanged")
        return this.status(courseId, sessionId, exported.exportId, actor);
      await existingJob.updateData({
        ...existingJob.data,
        actor,
        acknowledgeAssessmentChanges:
          existingJob.data.acknowledgeAssessmentChanges === true ||
          input.acknowledgeAssessmentChanges === true,
      });
      try {
        await existingJob.retry();
      } catch (error) {
        // Another editor may have resumed the same failed job first.
        if ((await existingJob.getState()) === "failed") throw error;
      }
      return this.status(courseId, sessionId, exported.exportId, actor);
    }
    await this.queue.enqueue<CourseAuthoringApplyJob>(
      QUEUE_NAMES.COURSE_AUTHORING_APPLY,
      "apply",
      {
        courseId,
        sessionId,
        exportId: exported.exportId,
        actor,
        acknowledgeAssessmentChanges: input.acknowledgeAssessmentChanges,
      },
      {
        jobId,
        attempts: 3,
        backoff: { type: "exponential", delay: 1000 },
        removeOnComplete: { age: 604800 },
        removeOnFail: { age: 604800 },
      },
    );
    return this.status(courseId, sessionId, exported.exportId, actor);
  }

  /** Reports queued, running, failed, conflicted, or durably applied export state. */
  async status(
    courseId: string,
    sessionId: string,
    exportId: string,
    actor: CurrentUserType,
  ): Promise<AuthoringApplyStatus> {
    await this.sessions.get(courseId, sessionId, actor);
    const receipt = await this.receipts.findReceipt(courseId, exportId, actor.tenantId);
    if (receipt) return { exportId, status: "applied", receipt };
    const job = await this.queue
      .getQueue(QUEUE_NAMES.COURSE_AUTHORING_APPLY)
      .getJob(`${actor.tenantId}-${exportId}`);
    if (!job || job.data.courseId !== courseId || job.data.sessionId !== sessionId)
      throw new NotFoundException("courseAuthoring.errors.applicationNotFound");
    const state = await job.getState();
    if (state === "failed")
      return {
        exportId,
        status:
          job.failedReason === "courseAuthoring.errors.baselineChanged" ? "conflict" : "failed",
        reason:
          job.failedReason.startsWith("courseAuthoring.errors.") ||
          job.failedReason.startsWith("aiJudgeConfiguration.errors.") ||
          job.failedReason.startsWith("adminCourseView.curriculum.lesson.aiJudge.validation.") ||
          job.failedReason === "adminCourseView.toast.languageNotSupported"
            ? job.failedReason
            : "courseAuthoring.errors.applicationFailed",
      };
    return { exportId, status: state === "active" ? "running" : "queued" };
  }

  /** Downloads and verifies a frozen export before applying it and recording its receipt. */
  async process(data: CourseAuthoringApplyJob) {
    const actor = await this.context.authorize(data.courseId, data.actor);
    await this.sessions.get(data.courseId, data.sessionId, actor);
    const client = await this.luma.getLumaClient();
    const exported = await client.authoring.getExport({
      sessionId: data.sessionId,
      exportId: data.exportId,
    });
    if (
      !Value.Check(frozenAuthoringExportSchema, exported) ||
      exported.courseId !== data.courseId ||
      exported.sessionId !== data.sessionId
    )
      throw new BadGatewayException("courseAuthoring.errors.invalidServiceResponse");
    if (courseAuthoringExportHash(exported) !== exported.exportHash)
      throw new BadGatewayException("courseAuthoring.errors.exportHashMismatch");
    const existing = await this.receipts.findReceipt(data.courseId, data.exportId, actor.tenantId);
    if (existing && existing.exportHash !== exported.exportHash)
      throw new ConflictException("courseAuthoring.errors.exportChanged");
    const assets: Record<string, string> = {};
    const assetMimeTypes: Record<string, string> = {};
    const preparedDocumentIds: Record<string, string[]> = {};
    if (!existing)
      for (const asset of exported.assets) {
        if (asset.byteSize > MAX_FILE_SIZE)
          throw new BadRequestException("courseAuthoring.errors.assetTooLarge");
        const downloaded = await client.authoring.downloadAsset({
          sessionId: data.sessionId,
          assetId: asset.assetId,
          revision: asset.revision,
          maxBytes: asset.byteSize,
        });
        const buffer = Buffer.from(downloaded.bytes);
        if (
          downloaded.revision !== asset.revision ||
          buffer.length !== asset.byteSize ||
          createHash("sha256").update(buffer).digest("hex") !== asset.sha256
        )
          throw new BadGatewayException("courseAuthoring.errors.assetHashMismatch");
        const file: Express.Multer.File = {
          fieldname: "asset",
          originalname: asset.assetId,
          encoding: "7bit",
          mimetype: asset.mimeType,
          size: buffer.length,
          buffer,
          stream: Readable.from(buffer),
          destination: "",
          filename: asset.assetId,
          path: "",
        };
        if (asset.role === "mentor_context") {
          if (!asset.operationId || asset.mimeType !== "text/plain")
            throw new BadRequestException("courseAuthoring.errors.invalidMentorMaterial");
          const operation = exported.operations.find(
            (item) => item.operationId === asset.operationId,
          );
          if (
            !operation ||
            (operation.type !== "lesson.create" && operation.type !== "lesson.update") ||
            operation.payload.lessonType !== "ai_mentor" ||
            (asset.sourceVersionId &&
              !operation.payload.sourceVersionIds.includes(asset.sourceVersionId))
          )
            throw new BadRequestException("courseAuthoring.errors.invalidMentorMaterial");
          file.originalname = `${actor.tenantId}-${asset.assetId}-${asset.revision}.txt`;
          if (!asset.sourceVersionId) {
            const materialKey = mentorTargetedContextKey(asset.operationId);
            if (preparedDocumentIds[materialKey]?.length || asset.sectionIds?.length)
              throw new BadRequestException("courseAuthoring.errors.invalidMentorMaterial");
            preparedDocumentIds[materialKey] = [
              await this.ingestion.prepareUnassignedMentorContextDocument(file),
            ];
            continue;
          }
          const documentId = await this.ingestion.prepareUnassignedDocument(file);
          const materialKey = `${asset.operationId}:${asset.sourceVersionId}`;
          preparedDocumentIds[materialKey] = [
            ...(preparedDocumentIds[materialKey] ?? []),
            documentId,
          ];
          continue;
        }
        await FileGuard.validateFile(file, {
          allowedTypes: ALLOWED_LESSON_IMAGE_FILE_TYPES,
          maxSize: MAX_FILE_SIZE,
        });
        const key = prefixTenantStorageKey(
          `course-authoring/${data.sessionId}/${asset.assetId}/${asset.revision}/${asset.sha256}`,
          actor.tenantId,
        );
        await this.receipts.recordStagedAsset(actor.tenantId, data.sessionId, data.exportId, key);
        await this.storage.uploadFile(buffer, key, asset.mimeType);
        assets[asset.assetId] = key;
        assetMimeTypes[asset.assetId] = asset.mimeType;
      }
    if (!existing) {
      const operations = exported.operations;
      const lessonOperations = operations.filter(
        (
          operation,
        ): operation is Extract<
          (typeof exported.operations)[number],
          { type: "lesson.create" | "lesson.update" }
        > => operation.type === "lesson.create" || operation.type === "lesson.update",
      );
      const mentorOperations = lessonOperations.filter(
        (operation) =>
          operation.payload.lessonType === "ai_mentor" &&
          !preparedDocumentIds[mentorTargetedContextKey(operation.operationId)]?.length,
      );
      if (mentorOperations.length) {
        const existingLessons = await this.context.getMentorContextLessons(
          data.courseId,
          exported.language,
          actor,
        );
        for (const operation of mentorOperations) {
          const documentText = buildMentorCourseContextDocument(
            operation.payload.title,
            existingLessons,
            operations,
          );
          if (!documentText) continue;
          const buffer = Buffer.from(documentText, "utf8");
          const filename = `${actor.tenantId}-${data.exportId}-${operation.operationId}-course-context.txt`;
          const file: Express.Multer.File = {
            fieldname: "mentor-context",
            originalname: filename,
            encoding: "7bit",
            mimetype: "text/plain",
            size: buffer.length,
            buffer,
            stream: Readable.from(buffer),
            destination: "",
            filename,
            path: "",
          };
          preparedDocumentIds[mentorCourseContextKey(operation.operationId)] = [
            await this.ingestion.prepareUnassignedMentorContextDocument(file),
          ];
        }
      }
    }
    const receipt =
      existing ??
      (await this.apply.applyPreparedExport(
        {
          ...exported,
          assetMappings: assets,
          preparedDocumentIds,
          assetMimeTypes,
          acknowledgeAssessmentChanges: data.acknowledgeAssessmentChanges,
        },
        actor,
      ));
    await client.authoring.recordReceipt({
      sessionId: data.sessionId,
      receipt: {
        courseId: data.courseId,
        sessionId: data.sessionId,
        applicationId: receipt.applicationId,
        exportId: data.exportId,
        exportHash: receipt.exportHash,
        status: "applied",
        idMappings: receipt.entityMappings,
        reason: null,
      },
    });
    await this.receipts.markDelivered(actor.tenantId, data.exportId, receipt.exportHash);
    return receipt;
  }
}
