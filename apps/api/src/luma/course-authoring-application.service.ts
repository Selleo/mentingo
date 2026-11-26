/** Validates frozen authoring exports, stages assets, and queues atomic native application work. */
import { createHash, randomUUID } from "node:crypto";
import { Readable } from "node:stream";

import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { ALLOWED_LESSON_IMAGE_FILE_TYPES, MAX_FILE_SIZE_BYTES } from "@repo/shared";
import { Value } from "@sinclair/typebox/value";
import { isAxiosError } from "axios";
import { load } from "cheerio";
import { v5 as uuidv5 } from "uuid";

import { isRecord } from "src/common/utils/object.utils";
import { FileGuard } from "src/file/guards/file.guard";
import { prefixTenantStorageKey } from "src/file/utils/tenantStorageKey";
import { validateAudioUpload } from "src/file/utils/validate-audio";
import { IngestionProcessingService } from "src/ingestion/services/ingestion-processing.service";
import { QUEUE_NAMES, QueueService } from "src/queue";
import { S3Service } from "src/s3/s3.service";

import { CourseAuthoringApplicationRepository } from "./course-authoring-application.repository";
import { CourseAuthoringApplyService } from "./course-authoring-apply.service";
import { CourseAuthoringContextService } from "./course-authoring-context.service";
import { CourseAuthoringDraftApplyService } from "./course-authoring-draft-apply.service";
import { CourseAuthoringDraftTransitionService } from "./course-authoring-draft-transition.service";
import { courseAuthoringExportHash } from "./course-authoring-export-hash";
import {
  buildMentorCourseContextDocument,
  mentorCourseContextKey,
  mentorTargetedContextKey,
} from "./course-authoring-mentor-context";
import { CourseAuthoringSessionService } from "./course-authoring-session.service";
import { LumaService } from "./luma.service";
import { frozenAuthoringExportSchema } from "./schema/course-authoring-application.schema";

import type { AuthoringMentorContextLesson } from "./course-authoring-context.types";
import type {
  CourseAuthoringApplyJob,
  CourseAuthoringAutonomousFence,
  CourseAuthoringReceiptJob,
} from "./course-authoring.types";
import type {
  AuthoringApplyStatus,
  FrozenAuthoringExport,
} from "./schema/course-authoring-application.schema";
import type {
  AuthoringCommandBody,
  AuthoringCommandReceiptResponse,
  AuthoringSession,
  PrepareAuthoringExportBody,
} from "./schema/course-authoring-session.schema";
import type { CurrentUserType } from "src/common/types/current-user.type";

const AUTHORING_SELECTION_NAMESPACE = "d7c56648-dc67-4a51-9a91-c318311b10e7";

/** Identifies the immutable export contents independently of the editor and apply attempt. */
const selectionCommandId = (
  sessionId: string,
  proposalIds: string[],
  omittedAssetIds: string[],
  terminalApplicationId: string | null = null,
  autonomousFence?: CourseAuthoringAutonomousFence,
) =>
  uuidv5(
    JSON.stringify({
      sessionId,
      ...(terminalApplicationId ? { terminalApplicationId } : {}),
      proposalIds: [...new Set(proposalIds)].sort(),
      omittedAssetIds: [...new Set(omittedAssetIds)].sort(),
      ...(autonomousFence ? { autonomousFence } : {}),
    }),
    AUTHORING_SELECTION_NAMESPACE,
  );

function plannedPodcasts(session: AuthoringSession, proposalIds: readonly string[]) {
  const selection = new Set(proposalIds);
  return session.records.flatMap(({ id, kind, payload }) => {
    if (
      kind !== "proposal" ||
      !selection.has(typeof payload.id === "string" ? payload.id : id) ||
      !Array.isArray(payload.assetRequests)
    )
      return [];
    return payload.assetRequests.filter(
      (request): request is { assetId: string; operationId: string } =>
        isRecord(request) &&
        request.purpose === "podcast" &&
        typeof request.assetId === "string" &&
        typeof request.operationId === "string",
    );
  });
}

function readFrozenExport(
  response: unknown,
  { courseId, sessionId, exportId }: { courseId: string; sessionId: string; exportId?: string },
): FrozenAuthoringExport {
  if (
    !Value.Check(frozenAuthoringExportSchema, response) ||
    response.courseId !== courseId ||
    response.sessionId !== sessionId ||
    (exportId !== undefined && response.exportId !== exportId)
  )
    throw new BadGatewayException("courseAuthoring.errors.invalidServiceResponse");
  return response;
}

/** Checks both planned placements and their frozen, downloadable podcast manifests. */
function validateFrozenPodcasts(exported: FrozenAuthoringExport, session: AuthoringSession) {
  if ("deferredPodcasts" in exported && exported.deferredPodcasts !== undefined) {
    const legacy = exported.deferredPodcasts;
    if (!Array.isArray(legacy) || legacy.length)
      throw new ConflictException("courseAuthoring.errors.assetNotReady");
  }

  const operationIds = new Set(exported.operations.map(({ operationId }) => operationId));
  const podcastAssets = exported.assets.filter(({ role }) => role === "podcast");
  const assetsById = new Map(podcastAssets.map((asset) => [asset.assetId, asset]));
  if (assetsById.size !== podcastAssets.length)
    throw new BadRequestException("courseAuthoring.errors.invalidOperations");

  for (const request of plannedPodcasts(session, exported.proposalIds)) {
    if (
      operationIds.has(request.operationId) &&
      assetsById.get(request.assetId)?.operationId !== request.operationId
    )
      throw new ConflictException("courseAuthoring.errors.assetNotReady");
  }

  const placed = new Set<string>();
  for (const operation of exported.operations) {
    if (operation.type !== "lesson.create" && operation.type !== "lesson.update") continue;
    const html = load(operation.payload.description);
    for (const element of html("[data-authoring-asset-id]").toArray()) {
      const node = html(element);
      const assetId = node.attr("data-authoring-asset-id");
      if (!assetId) continue;
      const asset = assetsById.get(assetId);
      const isAudio = node.is('audio[data-node-type="audio"]');
      if (isAudio && !asset) throw new ConflictException("courseAuthoring.errors.assetNotReady");
      if (!asset) continue;
      if (
        !isAudio ||
        placed.has(assetId) ||
        asset.operationId !== operation.operationId ||
        asset.mimeType !== "audio/mpeg" ||
        asset.byteSize === 0 ||
        operation.payload.lessonType !== "content" ||
        operation.language !== exported.language
      )
        throw new BadRequestException("courseAuthoring.errors.invalidOperations");
      placed.add(assetId);
    }
  }
  if (placed.size !== podcastAssets.length)
    throw new BadRequestException("courseAuthoring.errors.invalidOperations");
}

@Injectable()
/** Coordinates export preparation, asset staging, queued application, and receipt handoff. */
export class CourseAuthoringApplicationService {
  private readonly logger = new Logger(CourseAuthoringApplicationService.name);
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
    private readonly draftApply: CourseAuthoringDraftApplyService,
    private readonly draftTransition: CourseAuthoringDraftTransitionService,
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
    autonomousFence?: CourseAuthoringAutonomousFence,
  ): Promise<AuthoringApplyStatus> {
    const access = await this.sessions.getWithAccess(courseId, sessionId, actor);
    const { snapshot: session } = access;
    if (access.draft?.courseId)
      throw new ConflictException("courseAuthoring.errors.selectionAlreadyApplied");
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
    if (omitOptionalAssetIds.length) {
      const omitted = new Set(omitOptionalAssetIds);
      if (plannedPodcasts(session, proposalIds).some((request) => omitted.has(request.assetId)))
        throw new ConflictException("courseAuthoring.errors.invalidOperations");
    }
    const terminal = await this.receipts.latestTerminalSessionReceipt(
      actor.tenantId,
      courseId,
      sessionId,
    );
    const commandId = selectionCommandId(
      sessionId,
      proposalIds,
      omitOptionalAssetIds,
      autonomousFence ? null : (terminal?.applicationId ?? null),
      autonomousFence,
    );
    const exportRequest = {
      commandId,
      proposalIds,
      ...(omitOptionalAssetIds.length ? { omitOptionalAssetIds } : {}),
      actorId: actor.userId,
      ...(!autonomousFence ? { manualApply: true } : {}),
      ...(autonomousFence
        ? {
            autonomousRequestId: autonomousFence.requestId,
            autonomousControlEpoch: autonomousFence.controlEpoch,
          }
        : {}),
    };
    const response = await client.authoring
      .prepareExport({
        sessionId,
        request: exportRequest,
      })
      .catch((error: unknown) => {
        if (isAxiosError(error) && error.response?.status === 409) {
          const reason = error.response.data?.detail;
          if (reason === "AUTHORING_SELECTION_ALREADY_APPLIED")
            throw new ConflictException("courseAuthoring.errors.selectionAlreadyApplied");
          if (reason === "AUTHORING_IDEMPOTENCY_CONFLICT")
            throw new ConflictException("courseAuthoring.errors.exportIdentityConflict");
          const conflictMessages: Record<string, string> = {
            AUTHORING_APPLICATION_PENDING: "courseAuthoring.errors.applicationInProgress",
            AUTHORING_EXPORT_PENDING: "courseAuthoring.errors.applicationInProgress",
            AUTHORING_PROPOSAL_NOT_ACCEPTED: "courseAuthoring.errors.proposalNotReady",
            AUTHORING_PROPOSAL_NOT_READY: "courseAuthoring.errors.proposalNotReady",
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
    const exported = readFrozenExport(response, { courseId, sessionId });
    validateFrozenPodcasts(exported, session);
    const queue = this.queue.getQueue(QUEUE_NAMES.COURSE_AUTHORING_APPLY);
    const jobId = `${actor.tenantId}-${exported.exportId}`;
    const existingJob = await queue.getJob(jobId);
    if (existingJob) {
      if (existingJob.data.courseId !== courseId || existingJob.data.sessionId !== sessionId)
        throw new ConflictException("courseAuthoring.errors.exportIdentityConflict");
      const state = await existingJob.getState();
      if (state !== "failed")
        return this.readStatus(courseId, sessionId, exported.exportId, actor.tenantId);
      await this.recordTerminalFailure(
        existingJob.data as CourseAuthoringApplyJob,
        existingJob.failedReason,
      );
      throw new ConflictException("courseAuthoring.errors.receiptSynchronizationPending");
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
        ...(access.draft ? { draftCourseId: access.draft.id } : {}),
      },
      {
        jobId,
        attempts: 3,
        backoff: { type: "exponential", delay: 1000 },
        removeOnComplete: { age: 604800 },
        removeOnFail: { age: 604800 },
      },
    );
    return this.readStatus(courseId, sessionId, exported.exportId, actor.tenantId);
  }

  /** Reports queued, running, failed, conflicted, or durably applied export state. */
  async status(
    courseId: string,
    sessionId: string,
    exportId: string,
    actor: CurrentUserType,
  ): Promise<AuthoringApplyStatus> {
    await this.sessions.get(courseId, sessionId, actor);
    return this.readStatus(courseId, sessionId, exportId, actor.tenantId);
  }

  private async readStatus(
    courseId: string,
    sessionId: string,
    exportId: string,
    tenantId: string,
  ): Promise<AuthoringApplyStatus> {
    const receipt = await this.receipts.findReceipt(courseId, exportId, tenantId);
    if (receipt) {
      if (receipt.sessionId !== sessionId)
        throw new NotFoundException("courseAuthoring.errors.applicationNotFound");
      if (receipt.status !== "applied")
        return {
          exportId,
          status: receipt.status,
          reason: receipt.reason ?? "courseAuthoring.errors.applicationFailed",
        };
      return { exportId, status: "applied", receipt: { ...receipt, status: "applied" } };
    }
    const job = await this.queue
      .getQueue(QUEUE_NAMES.COURSE_AUTHORING_APPLY)
      .getJob(`${tenantId}-${exportId}`);
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

  /** Reconciles a bounded page of final failed jobs after transient receipt-store outages. */
  async reconcileFailedApplications(tenantId: string, offset: number) {
    const jobs = await this.queue
      .getQueue(QUEUE_NAMES.COURSE_AUTHORING_APPLY)
      .getJobs(["failed"], offset, offset + 99);
    for (const job of jobs) {
      const data = job.data as CourseAuthoringApplyJob | CourseAuthoringReceiptJob;
      if (
        !("actor" in data) ||
        data.actor.tenantId !== tenantId ||
        (await job.getState()) !== "failed"
      )
        continue;
      try {
        await this.recordTerminalFailure(data, job.failedReason);
      } catch {
        this.logger.warn("A terminal application outcome will retry on a later receipt scan");
      }
    }
    return jobs.length === 100 ? offset + 100 : 0;
  }

  /** Records only a final queue failure; a committed native receipt always wins. */
  async recordTerminalFailure(data: CourseAuthoringApplyJob, reason: string) {
    const existing = await this.receipts.findReceipt(
      data.courseId,
      data.exportId,
      data.actor.tenantId,
    );
    if (existing) return existing;
    const client = await this.luma.getLumaClient();
    const response = await client.authoring.getExport({
      sessionId: data.sessionId,
      exportId: data.exportId,
    });
    const exported = readFrozenExport(response, data);
    if (courseAuthoringExportHash(exported) !== exported.exportHash)
      throw new BadGatewayException("courseAuthoring.errors.exportHashMismatch");
    const safeReason =
      reason.startsWith("courseAuthoring.errors.") ||
      reason.startsWith("aiJudgeConfiguration.errors.") ||
      reason.startsWith("adminCourseView.curriculum.lesson.aiJudge.validation.") ||
      reason === "adminCourseView.toast.languageNotSupported"
        ? reason
        : "courseAuthoring.errors.applicationFailed";
    const result = await this.receipts.recordFailureOnce(
      {
        tenantId: data.actor.tenantId,
        ...(data.draftCourseId ? { draftCourseId: data.draftCourseId } : {}),
        actorId: data.actor.userId,
        courseId: data.courseId,
        sessionId: data.sessionId,
        exportId: data.exportId,
        exportHash: exported.exportHash,
      },
      {
        applicationId: randomUUID(),
        exportHash: exported.exportHash,
        exportId: data.exportId,
        courseId: data.courseId,
        sessionId: data.sessionId,
        status: safeReason === "courseAuthoring.errors.baselineChanged" ? "conflict" : "failed",
        reason: safeReason,
        appliedOperationIds: [],
        entityMappings: {},
        assetMappings: {},
      },
    );
    await this.queue.enqueue<CourseAuthoringReceiptJob>(
      QUEUE_NAMES.COURSE_AUTHORING_APPLY,
      "receipt",
      {
        tenantId: data.actor.tenantId,
        courseId: data.courseId,
        sessionId: data.sessionId,
        exportId: data.exportId,
        exportHash: result.exportHash,
      },
      {
        jobId: `receipt-${data.actor.tenantId}-${data.exportId}`,
        attempts: 5,
        backoff: { type: "exponential", delay: 1000 },
        removeOnComplete: true,
        removeOnFail: true,
      },
    );
    return result;
  }

  /** Downloads and verifies a frozen export before applying it and recording its receipt. */
  async process(data: CourseAuthoringApplyJob) {
    const {
      actor,
      draft,
      snapshot: session,
    } = await this.sessions.getWithAccess(data.courseId, data.sessionId, data.actor);
    if ((draft?.id ?? undefined) !== data.draftCourseId)
      throw new ForbiddenException("common.toast.noAccess");
    const client = await this.luma.getLumaClient();
    const response = await client.authoring.getExport({
      sessionId: data.sessionId,
      exportId: data.exportId,
    });
    const exported = readFrozenExport(response, data);
    if (courseAuthoringExportHash(exported) !== exported.exportHash)
      throw new BadGatewayException("courseAuthoring.errors.exportHashMismatch");
    const courseCreate = exported.operations.some(
      (operation) => operation.type === "course.create",
    );
    if (courseCreate !== Boolean(draft) || (courseCreate && exported.operations.length !== 1))
      throw new BadRequestException("courseAuthoring.errors.invalidOperations");
    validateFrozenPodcasts(exported, session);
    const existing = await this.receipts.findReceipt(data.courseId, data.exportId, actor.tenantId);
    if (existing && existing.status !== "applied")
      throw new ConflictException(existing.reason ?? "courseAuthoring.errors.applicationFailed");
    if (existing && existing.exportHash !== exported.exportHash)
      throw new ConflictException("courseAuthoring.errors.exportChanged");
    const assets: Record<string, string> = {};
    const assetMimeTypes: Record<string, string> = {};
    const audioDurations: Record<string, number> = {};
    const preparedDocumentIds: Record<string, string[]> = {};
    if (!existing)
      for (const asset of exported.assets) {
        if (asset.byteSize > MAX_FILE_SIZE_BYTES)
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
              !(operation.payload.sourceVersionIds ?? []).includes(asset.sourceVersionId))
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
        if (asset.role === "podcast") {
          file.originalname = `${asset.assetId}.mp3`;
          const audio = await validateAudioUpload(file);
          if (audio.contentType !== "audio/mpeg")
            throw new BadRequestException("courseAuthoring.errors.invalidOperations");
          audioDurations[asset.assetId] = audio.durationSeconds;
        } else {
          await FileGuard.validateFile(file, {
            allowedTypes: ALLOWED_LESSON_IMAGE_FILE_TYPES,
            maxSize: MAX_FILE_SIZE_BYTES,
          });
        }
        const key = prefixTenantStorageKey(
          `course-authoring/${data.sessionId}/${asset.assetId}/${asset.revision}/${asset.sha256}`,
          actor.tenantId,
        );
        await this.receipts.recordStagedAsset(actor.tenantId, data.sessionId, data.exportId, key);
        await this.storage.uploadFile(file.buffer, key, file.mimetype);
        assets[asset.assetId] = key;
        assetMimeTypes[asset.assetId] = file.mimetype;
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
        const lessonsByLanguage = new Map<string, AuthoringMentorContextLesson[]>();
        for (const operation of mentorOperations) {
          let existingLessons = lessonsByLanguage.get(operation.language);
          if (!existingLessons) {
            existingLessons = await this.context.getMentorContextLessons(
              data.courseId,
              operation.language,
              actor,
            );
            lessonsByLanguage.set(operation.language, existingLessons);
          }
          const documentText = buildMentorCourseContextDocument(
            operation.payload.title,
            existingLessons,
            operations,
            operation.language,
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
    const application = {
      ...exported,
      assetMappings: assets,
      preparedDocumentIds,
      assetMimeTypes,
      audioDurations,
      acknowledgeAssessmentChanges: data.acknowledgeAssessmentChanges,
    };
    const receipt =
      existing ??
      (await (draft
        ? this.draftApply.applyPreparedExport(application, actor)
        : this.apply.applyPreparedExport(application, actor)));
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
    const nativeCourseId = receipt.entityMappings[data.courseId];
    if (draft && nativeCourseId) {
      await this.draftTransition.resume(
        {
          tenantId: actor.tenantId,
          courseId: data.courseId,
          sessionId: data.sessionId,
          exportId: data.exportId,
          exportHash: receipt.exportHash,
        },
        nativeCourseId,
      );
    }
    await this.receipts.markDelivered(actor.tenantId, data.exportId, receipt.exportHash);
    return receipt;
  }
}
