import { randomUUID } from "node:crypto";

import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { match } from "ts-pattern";

import { PermissionsService } from "src/permissions/permissions.service";
import { QUEUE_NAMES, QueueService } from "src/queue";
import { ReportsQueryService } from "src/report/reports-query.service";
import { S3Service } from "src/s3/s3.service";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import {
  REPORT_EXPORT_RETENTION_MS,
  REPORT_EXPORT_PROCESSING_LEASE_MS,
  REPORT_EXPORT_PROCESSING_HEARTBEAT_MS,
  REPORT_EXPORT_CLEANUP_BATCH_SIZE,
  REPORT_EXPORT_CLAIM_RETRY_DELAY_MS,
  REPORT_EXPORT_CONTENT_TYPES,
} from "./constants/reports-exports.constants";
import {
  REPORT_EXPORT_ACTION,
  REPORT_EXPORT_STATUS,
  REPORT_FAILURE_CODE,
  REPORT_VIEWS,
  REPORT_LIMITS,
} from "./constants/reports.constants";
import { REPORT_ERRORS } from "./constants/reports.errors";
import { ReportsExportRenderer } from "./reports-export.renderer";
import { ReportsExportsRepository } from "./repositories/reports-exports.repository";

import type {
  ReportExportClaim,
  ReportExportDownload,
  ReportExportFormat,
  ReportExportScope,
} from "./reports-exports.types";
import type { ReportExportRecord } from "./repositories/reports-exports.repository";
import type { CreateReportExport, ReportExportResponse } from "./schemas/reports-exports.schema";
import type { ReportsQuery, ReportsResult, ReportOptions } from "./schemas/reports.schema";
import type { CurrentUserType } from "src/common/types/current-user.type";
import type { ReportExportJobData } from "src/queue/queue.types";

@Injectable()
export class ReportsExportsService {
  private readonly logger = new Logger(ReportsExportsService.name);

  constructor(
    private readonly reportsExportsRepository: ReportsExportsRepository,
    private readonly queueService: QueueService,
    private readonly tenantDbRunnerService: TenantDbRunnerService,
    private readonly reportsQueryService: ReportsQueryService,
    private readonly permissionsService: PermissionsService,
    private readonly reportsExportRenderer: ReportsExportRenderer,
    private readonly s3Service: S3Service,
  ) {}

  async createExport(
    input: CreateReportExport,
    actor: CurrentUserType,
  ): Promise<ReportExportResponse> {
    this.assertExportStorageConfigured();
    const query = this.buildExportQuery(input);
    await this.reportsQueryService.validateReportAccess(query, actor);
    const accessFingerprint = await this.reportsQueryService.getReportAccessFingerprint(
      query,
      actor,
    );
    const record = await this.createPendingExportRecord(input, query, accessFingerprint, actor);

    await this.enqueueExportGenerationJob(record.id, actor);
    return this.buildExportResponse(record);
  }

  async getExportStatus(id: string, actor: CurrentUserType): Promise<ReportExportResponse> {
    const record = await this.getExportOwnedByActor(id, actor);
    const currentActor = await this.getCurrentExportActor(actor.tenantId, actor.userId);
    await this.assertExportAccessUnchanged(record, currentActor);
    return this.buildExportResponse(record);
  }

  async downloadExport(id: string, actor: CurrentUserType): Promise<ReportExportDownload> {
    const record = await this.getExportOwnedByActor(id, actor);
    const currentActor = await this.getCurrentExportActor(actor.tenantId, actor.userId);
    await this.assertExportAccessUnchanged(record, currentActor);
    this.assertExportReadyForDownload(record);

    if (this.isExportExpired(record)) {
      await this.removeExpiredExportArtifact(record);
      throw new NotFoundException(REPORT_ERRORS.EXPORT_EXPIRED);
    }

    return this.getExportDownload(record);
  }

  async processExportGenerationJob(
    data: ReportExportJobData,
    isFinalAttempt = true,
  ): Promise<void> {
    await this.tenantDbRunnerService.runWithTenant(data.tenantId, () =>
      this.generateExportArtifact(data, isFinalAttempt),
    );
  }

  async processExportExpirationJob(data: ReportExportJobData): Promise<void> {
    await this.tenantDbRunnerService.runWithTenant(data.tenantId, () =>
      this.removeExportArtifactIfExpired(data),
    );
  }

  async cleanupExpiredExportArtifactsForTenant(tenantId: string): Promise<void> {
    const expired = await this.reportsExportsRepository.findExpiredArtifacts(
      tenantId,
      new Date().toISOString(),
      REPORT_EXPORT_CLEANUP_BATCH_SIZE,
    );

    for (const artifact of expired) {
      if (!artifact.artifactKey) continue;
      try {
        await this.s3Service.deleteFile(artifact.artifactKey);
        await this.reportsExportsRepository.clearArtifact(
          tenantId,
          artifact.id,
          artifact.artifactKey,
        );
      } catch {
        this.logger.warn(
          `Could not remove expired report export ${artifact.id} for tenant ${tenantId}`,
        );
      }
    }
  }

  private assertExportStorageConfigured(): void {
    if (!this.s3Service.isConfigured()) {
      throw new ServiceUnavailableException(REPORT_ERRORS.EXPORT_STORAGE_UNAVAILABLE);
    }
  }

  private buildExportQuery(input: CreateReportExport): ReportsQuery {
    return { ...input.query, language: input.language, page: 1, pageSize: REPORT_LIMITS.PAGE_SIZE };
  }

  private async createPendingExportRecord(
    input: CreateReportExport,
    query: ReportsQuery,
    accessFingerprint: string,
    actor: CurrentUserType,
  ): Promise<ReportExportRecord> {
    return this.reportsExportsRepository.createPending({
      tenantId: actor.tenantId,
      actorId: actor.userId,
      format: input.format,
      status: REPORT_EXPORT_STATUS.PENDING,
      query,
      accessFingerprint,
    });
  }

  private async enqueueExportGenerationJob(
    exportId: string,
    actor: CurrentUserType,
  ): Promise<void> {
    const data: ReportExportJobData = {
      tenantId: actor.tenantId,
      exportId,
      actorId: actor.userId,
      action: REPORT_EXPORT_ACTION.GENERATE,
    };
    try {
      await this.queueService.enqueue<ReportExportJobData>(
        QUEUE_NAMES.REPORT_EXPORT,
        REPORT_EXPORT_ACTION.GENERATE,
        data,
        {
          jobId: exportId,
          attempts: 3,
          backoff: { type: "exponential", delay: 5000 },
        },
      );
    } catch {
      await this.reportsExportsRepository.markQueueUnavailable(actor.tenantId, exportId);
      throw new ServiceUnavailableException(REPORT_ERRORS.EXPORT_QUEUE_UNAVAILABLE);
    }
  }

  private async getExportOwnedByActor(
    id: string,
    actor: CurrentUserType,
  ): Promise<ReportExportRecord> {
    const record = await this.reportsExportsRepository.findForActor(
      actor.tenantId,
      actor.userId,
      id,
    );
    if (!record) throw new NotFoundException(REPORT_ERRORS.EXPORT_NOT_FOUND);
    return record;
  }

  private async assertExportAccessUnchanged(
    record: ReportExportRecord,
    actor: CurrentUserType,
  ): Promise<void> {
    const actualFingerprint = await this.reportsQueryService.getReportAccessFingerprint(
      record.query,
      actor,
    );
    if (actualFingerprint !== record.accessFingerprint) {
      throw new ForbiddenException(REPORT_ERRORS.EXPORT_ACCESS_CHANGED);
    }
    await this.reportsQueryService.validateReportAccess(record.query, actor);
  }

  private assertExportReadyForDownload(
    record: ReportExportRecord,
  ): asserts record is ReportExportRecord & {
    artifactKey: string;
    expiresAt: string;
  } {
    const isAvailable =
      record.status === REPORT_EXPORT_STATUS.COMPLETED &&
      record.artifactKey !== null &&
      record.expiresAt !== null;
    if (!isAvailable) throw new NotFoundException(REPORT_ERRORS.EXPORT_UNAVAILABLE);
  }

  private isExportExpired(record: Pick<ReportExportRecord, "expiresAt">): boolean {
    return record.expiresAt !== null && new Date(record.expiresAt).getTime() <= Date.now();
  }

  private async removeExpiredExportArtifact(
    record: ReportExportRecord & { artifactKey: string },
  ): Promise<void> {
    await this.s3Service.deleteFile(record.artifactKey).catch(() => undefined);
    await this.reportsExportsRepository.clearArtifact(
      record.tenantId,
      record.id,
      record.artifactKey,
    );
  }

  private async getExportDownload(
    record: ReportExportRecord & { artifactKey: string },
  ): Promise<ReportExportDownload> {
    const { stream } = await this.s3Service.getFileStream(record.artifactKey);

    return {
      stream,
      fileName: `learning-report-${record.id}.${record.format}`,
      contentType: REPORT_EXPORT_CONTENT_TYPES[record.format],
    };
  }

  private async generateExportArtifact(
    data: ReportExportJobData,
    isFinalAttempt: boolean,
  ): Promise<void> {
    const claim = await this.claimExportForProcessing(data);
    if (!claim) return;
    await this.generateClaimedExportArtifact(claim, data, isFinalAttempt);
  }

  private async claimExportForProcessing(
    data: ReportExportJobData,
  ): Promise<ReportExportClaim | null> {
    while (true) {
      const record = await this.reportsExportsRepository.findForJob(
        data.tenantId,
        data.actorId,
        data.exportId,
      );
      if (!record || record.status === REPORT_EXPORT_STATUS.COMPLETED) return null;

      const token = randomUUID();
      const staleBefore = new Date(Date.now() - REPORT_EXPORT_PROCESSING_LEASE_MS).toISOString();
      const claimed = await this.reportsExportsRepository.claim(
        data.tenantId,
        data.actorId,
        data.exportId,
        token,
        staleBefore,
      );
      if (claimed) return { record, token };
      await this.waitBeforeRetryingExportClaim();
    }
  }

  private async waitBeforeRetryingExportClaim(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, REPORT_EXPORT_CLAIM_RETRY_DELAY_MS));
  }

  private async generateClaimedExportArtifact(
    claim: ReportExportClaim,
    data: ReportExportJobData,
    isFinalAttempt: boolean,
  ): Promise<void> {
    const stopHeartbeat = this.startExportProcessingHeartbeat(claim);
    let artifactKey: string | undefined;
    try {
      const result = await this.getReportSnapshotWithAccessChecks(claim.record, data);
      const scope = await this.getExportScopeLabels(claim.record.query, data);
      artifactKey = this.buildExportArtifactKey(data, claim);
      await this.renderAndUploadExportArtifact(
        claim.record.format,
        result,
        claim.record.query,
        scope,
        artifactKey,
      );

      const isCompleted = await this.completeClaimedExport(claim, artifactKey);
      if (!isCompleted) {
        // A newer processor took over the export; its artifact wins.
        await this.tryDeleteExportArtifact(artifactKey);
        return;
      }
      await this.enqueueExportExpirationJob(data);
    } catch (error) {
      await this.failClaimedExport(claim, artifactKey, error, isFinalAttempt);
      throw error;
    } finally {
      stopHeartbeat();
    }
  }

  private async completeClaimedExport(
    claim: ReportExportClaim,
    artifactKey: string,
  ): Promise<boolean> {
    return this.reportsExportsRepository.completeClaim(
      claim.record.tenantId,
      claim.record.id,
      claim.token,
      {
        artifactKey,
        expiresAt: new Date(Date.now() + REPORT_EXPORT_RETENTION_MS).toISOString(),
      },
    );
  }

  private async failClaimedExport(
    claim: ReportExportClaim,
    artifactKey: string | undefined,
    error: unknown,
    isFinalAttempt: boolean,
  ): Promise<void> {
    if (artifactKey) await this.tryDeleteExportArtifact(artifactKey);
    await this.reportsExportsRepository.failClaim(
      claim.record.tenantId,
      claim.record.id,
      claim.token,
      REPORT_FAILURE_CODE.EXPORT_FAILED,
      isFinalAttempt,
    );
    this.logExportGenerationFailure(claim.record.id, error);
  }

  private startExportProcessingHeartbeat(claim: ReportExportClaim): () => void {
    const heartbeat = setInterval(() => {
      void this.reportsExportsRepository
        .renewClaim(claim.record.tenantId, claim.record.id, claim.token)
        .catch(() => {
          this.logger.warn(`Could not renew processing lease for report export ${claim.record.id}`);
        });
    }, REPORT_EXPORT_PROCESSING_HEARTBEAT_MS);
    heartbeat.unref?.();
    return () => clearInterval(heartbeat);
  }

  private async getReportSnapshotWithAccessChecks(
    record: ReportExportRecord,
    data: ReportExportJobData,
  ): Promise<ReportsResult> {
    const actor = await this.getCurrentExportActor(data.tenantId, data.actorId);
    await this.reportsQueryService.validateReportAccess(record.query, actor);
    await this.assertExportAccessUnchanged(record, actor);

    const result = await this.reportsQueryService.getAllReportRows(record.query, actor);
    const latestActor = await this.getCurrentExportActor(data.tenantId, data.actorId);
    await this.assertExportAccessUnchanged(record, latestActor);
    return result;
  }

  private async getExportScopeLabels(
    query: ReportsQuery,
    data: ReportExportJobData,
  ): Promise<ReportExportScope> {
    const actor = await this.getCurrentExportActor(data.tenantId, data.actorId);
    const options = await this.reportsQueryService.getReportOptions(actor, query.language);
    const subjectOptions = this.getReportSubjectOptions(query, options);
    const labelOf = (items: ReportOptions["groups"], id: string) =>
      items.find((item) => item.id === id)?.label ?? id;

    const recordLabels = Object.fromEntries(
      [...options.groups, ...options.courses, ...options.paths, ...options.learners].map(
        ({ id, label }) => [id, label],
      ),
    );

    return {
      groups: query.groupIds.map((id) => labelOf(options.groups, id)),
      subject: query.subjectId ? labelOf(subjectOptions, query.subjectId) : null,
      recordLabels,
    };
  }

  private getReportSubjectOptions(
    query: ReportsQuery,
    options: ReportOptions,
  ): ReportOptions["courses"] {
    return match(query.view)
      .with(REPORT_VIEWS.COURSE, () => options.courses)
      .with(REPORT_VIEWS.DEVELOPMENT_PATHS, () => options.paths)
      .with(REPORT_VIEWS.LEARNER, () => options.learners)
      .otherwise(() => []);
  }

  private buildExportArtifactKey(data: ReportExportJobData, claim: ReportExportClaim): string {
    return `reports/exports/${data.tenantId}/${claim.record.id}-${claim.token}.${claim.record.format}`;
  }

  private async renderAndUploadExportArtifact(
    format: ReportExportFormat,
    result: ReportsResult,
    query: ReportsQuery,
    scope: ReportExportScope,
    artifactKey: string,
  ): Promise<void> {
    const renderStartedAt = new Date();
    const stream = await this.reportsExportRenderer.render(
      format,
      result,
      query,
      renderStartedAt,
      scope,
    );
    await this.s3Service.uploadStreamMultipart(
      stream,
      artifactKey,
      REPORT_EXPORT_CONTENT_TYPES[format],
    );
  }

  private async tryDeleteExportArtifact(artifactKey: string): Promise<void> {
    await this.s3Service.deleteFile(artifactKey).catch(() => undefined);
  }

  private async enqueueExportExpirationJob(data: ReportExportJobData): Promise<void> {
    await this.queueService
      .enqueue<ReportExportJobData>(
        QUEUE_NAMES.REPORT_EXPORT,
        REPORT_EXPORT_ACTION.EXPIRE,
        { ...data, action: REPORT_EXPORT_ACTION.EXPIRE },
        { jobId: `${data.exportId}-expire`, delay: REPORT_EXPORT_RETENTION_MS, attempts: 5 },
      )
      .catch(() => {
        this.logger.warn(`Could not schedule expiration for report export ${data.exportId}`);
      });
  }

  private logExportGenerationFailure(exportId: string, error: unknown): void {
    this.logger.error(
      `${REPORT_ERRORS.EXPORT_GENERATION_FAILED}: ${exportId}`,
      error instanceof Error ? error.stack : undefined,
    );
  }

  private async removeExportArtifactIfExpired(data: ReportExportJobData): Promise<void> {
    const record = await this.reportsExportsRepository.findForJob(
      data.tenantId,
      data.actorId,
      data.exportId,
    );
    if (!record?.artifactKey || !record.expiresAt) return;
    const waitMs = new Date(record.expiresAt).getTime() - Date.now();
    if (waitMs > 0) {
      await this.rescheduleExportExpirationJob(data, record.expiresAt, waitMs);
      return;
    }

    await this.s3Service.deleteFile(record.artifactKey);
    await this.reportsExportsRepository.clearArtifact(data.tenantId, record.id, record.artifactKey);
  }

  private async rescheduleExportExpirationJob(
    data: ReportExportJobData,
    expiresAt: string,
    waitMs: number,
  ): Promise<void> {
    await this.queueService.enqueue<ReportExportJobData>(
      QUEUE_NAMES.REPORT_EXPORT,
      REPORT_EXPORT_ACTION.EXPIRE,
      { ...data, action: REPORT_EXPORT_ACTION.EXPIRE },
      { jobId: `${data.exportId}-expire-${Date.parse(expiresAt)}`, delay: waitMs, attempts: 5 },
    );
  }

  private async getCurrentExportActor(tenantId: string, actorId: string): Promise<CurrentUserType> {
    const identity = await this.reportsExportsRepository.findActorIdentity(tenantId, actorId);
    if (!identity) throw new ForbiddenException(REPORT_ERRORS.EXPORT_ACTOR_UNAVAILABLE);

    const access = await this.permissionsService.getUserAccess(identity.id);
    return {
      userId: identity.id,
      email: identity.email,
      tenantId: identity.tenantId,
      permissions: access.permissions,
      roleSlugs: access.roleSlugs,
    };
  }

  private buildExportResponse(record: ReportExportRecord): ReportExportResponse {
    return {
      id: record.id,
      format: record.format,
      status: record.status,
      expiresAt: record.expiresAt,
      failureCode: record.failureCode,
    };
  }
}
