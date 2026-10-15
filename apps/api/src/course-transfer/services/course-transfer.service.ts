import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { COURSE_ORIGIN_TYPES } from "@repo/shared";
import { Value } from "@sinclair/typebox/value";
import { match } from "ts-pattern";

import { parsePagination } from "src/common/pagination";
import { LEARNING_PATH_ERRORS } from "src/learning-path/constants/learning-path.errors";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import {
  COURSE_TRANSFER_CANDIDATES_PAGE_SIZE,
  COURSE_TRANSFER_JOB_TARGETS,
  COURSE_TRANSFER_KINDS,
  COURSE_TRANSFER_MODES,
  COURSE_TRANSFER_RELATIONSHIP_ERRORS,
  COURSE_TRANSFER_TRIGGERS,
} from "../course-transfer.constants";
import { CourseTransferCoordinator } from "../course-transfer.coordinator";
import { CourseTransferRelationshipRepository } from "../repositories/course-transfer-relationship.repository";
import {
  courseTransferJobSchema,
  courseTransferRelationshipRefSchema,
} from "../schemas/course-transfer.schema";

import { CourseTransferAssetService } from "./course-transfer-asset.service";
import { CourseTransferMaterializerService } from "./course-transfer-materializer.service";
import { CourseTransferRelationshipService } from "./course-transfer-relationship.service";
import { CourseTransferSnapshotService } from "./course-transfer-snapshot.service";

import type {
  CourseTransferExportCandidatesSearch,
  CourseTransferExportCandidatesPage,
  CourseTransferExportCandidatesQuery,
  CourseTransferCopyCourseInput,
  CourseTransferCopyCourseResult,
  CourseTransferDependency,
  CourseTransferExportRequest,
  CourseTransferExportResult,
  CourseTransferJob,
  CourseTransferJobStatus,
  CourseTransferKind,
  CourseTransferLeasedTransfer,
  CourseTransferRelationship,
  CourseTransferRelationshipPair,
  CourseTransferRelationshipRef,
  CourseTransferRequest,
  CourseTransferStreamKey,
  CourseTransferSyncPolicy,
  CourseTransferSyncRequest,
  CourseTransferTargetOrDependency,
} from "../course-transfer.types";
import type { CourseTransferPreparedLearningPathCourse } from "../types/course-transfer-graph.types";
import type { DatabasePg, UUIDType } from "src/common";

/**
 * The single entry point for copying courses and learning paths. Callers supply an authorized
 * source, destination, and policy; this service owns tenant switching and every copy step.
 */
@Injectable()
export class CourseTransferService {
  constructor(
    private readonly courseTransferCoordinator: CourseTransferCoordinator,
    private readonly courseTransferRelationshipRepository: CourseTransferRelationshipRepository,
    private readonly courseTransferRelationshipService: CourseTransferRelationshipService,
    private readonly courseTransferSnapshotService: CourseTransferSnapshotService,
    private readonly courseTransferAssetService: CourseTransferAssetService,
    private readonly courseTransferMaterializerService: CourseTransferMaterializerService,
    private readonly tenantDbRunnerService: TenantDbRunnerService,
  ) {}

  /**
   * Opens a sharing relationship (or reopens a failed one) and records its first transfer.
   * Must be called in the source tenant context after the caller authorized the target tenant.
   */
  async requestExport(request: CourseTransferExportRequest): Promise<CourseTransferExportResult> {
    return this.tenantDbRunnerService.transactionWithHandle(async (transaction) => {
      await this.courseTransferRelationshipRepository.markSourceAsMaster(
        request.kind,
        request.sourceId,
        transaction,
      );

      const { relationship, isClaimed } = await this.claimRelationshipForExport(
        request,
        transaction,
      );

      if (!isClaimed) {
        return {
          targetTenantId: request.targetTenantId,
          queued: false,
          reason: "already-linked",
          exportId: relationship.id,
        };
      }

      const operation = await this.courseTransferCoordinator.recordTransferRequest(
        this.buildTransferRequest(relationship, {
          triggerEventType: COURSE_TRANSFER_TRIGGERS.EXPORT,
          actorId: request.actorId,
        }),
        transaction,
      );

      return {
        targetTenantId: request.targetTenantId,
        queued: true,
        reason: operation.id,
        exportId: relationship.id,
      };
    });
  }

  /** Records a sync for every active sharing relationship of a changed source. */
  async requestSync(request: CourseTransferSyncRequest): Promise<void> {
    if (!request.relationships.length) return;

    await this.tenantDbRunnerService.transactionWithHandle((transaction) =>
      this.courseTransferRelationshipRepository.markSourceAsMaster(
        request.kind,
        request.sourceId,
        transaction,
      ),
    );

    const failures: unknown[] = [];
    for (const relationship of request.relationships) {
      const relationshipRef = { ...relationship, kind: request.kind };
      if (!this.hasValidRelationshipIds(relationshipRef)) {
        await this.courseTransferRelationshipRepository.markFailed(request.kind, relationship.id);
        continue;
      }

      try {
        await this.tenantDbRunnerService.transactionWithHandle(async (transaction) => {
          await this.courseTransferCoordinator.recordTransferRequest(
            this.buildTransferRequest(relationshipRef, {
              triggerEventType: request.triggerEventType,
            }),
            transaction,
          );
          await this.courseTransferRelationshipRepository.markPending(
            request.kind,
            relationship.id,
            transaction,
          );
        });
      } catch (error) {
        failures.push(error);
      }
    }

    if (failures.length) {
      throw new AggregateError(failures, `Could not request all ${request.kind} transfers`);
    }
  }

  /**
   * Transfers the sharing relationship named by a worker job into its destination tenant.
   * Resolves to null when the transfer waits for other transfers, such as a path's courses.
   */
  async transferFromJob(job: CourseTransferJob): Promise<UUIDType | null> {
    if (!this.hasValidJobIds(job)) {
      throw new BadRequestException(COURSE_TRANSFER_RELATIONSHIP_ERRORS[job.kind].invalidJob);
    }

    return this.tenantDbRunnerService.runWithTenant(job.sourceTenantId, async () => {
      const relationship = await this.findRelationshipForJob(job);
      this.courseTransferRelationshipService.assertRelationshipIsActive(relationship);

      const operationId =
        job.operationId ??
        (
          await this.courseTransferCoordinator.recordTransferRequest({
            ...this.toStreamKey(relationship),
            payload: job.payload,
          })
        ).id;

      return this.transferRelationshipUnderLease(relationship, operationId);
    });
  }

  /** Copies a course once into an existing course of the same tenant, without a relationship. */
  async copyCourseIntoExistingCourse(
    input: CourseTransferCopyCourseInput,
  ): Promise<CourseTransferCopyCourseResult> {
    const { source, destination, policy } = input;
    if (source.tenantId !== destination.tenantId) {
      throw new Error("A course copy must stay within one tenant");
    }

    const snapshot =
      "snapshot" in source ? source.snapshot : await this.readCourseToCopy(source.courseId);
    const targetCourse = await this.courseTransferMaterializerService.findDuplicateDestination(
      destination.courseId,
    );
    const preparedCourse = await this.courseTransferAssetService.prepareCourse({
      snapshot,
      sourceTenantId: source.tenantId,
      destination,
      policy,
    });

    return this.courseTransferMaterializerService.duplicateCourse(
      preparedCourse,
      policy,
      targetCourse,
    );
  }

  /** Lists the tenants a source can be shared with, one page at a time. */
  async listExportCandidates(
    source: Pick<CourseTransferExportCandidatesQuery, "kind" | "sourceTenantId" | "sourceId">,
    search: CourseTransferExportCandidatesSearch,
  ): Promise<CourseTransferExportCandidatesPage> {
    const { page, perPage } = parsePagination(search.page, search.perPage, {
      perPage: COURSE_TRANSFER_CANDIDATES_PAGE_SIZE,
    });

    const query = { ...source, search: search.search?.trim() || undefined, page, perPage };

    const [candidates, totalItems, summary] = await Promise.all([
      this.courseTransferRelationshipRepository.findExportCandidatesPage(query),
      this.courseTransferRelationshipRepository.countExportCandidates(query),
      this.courseTransferRelationshipRepository.summarizeExportCandidates(query),
    ]);

    return {
      tenants: candidates,
      summary: {
        ...summary,
        remainingCount: Math.max(summary.totalTenants - summary.exportedCount, 0),
      },
      pagination: { totalItems, page: query.page, perPage: query.perPage },
    };
  }

  async findEligibleTargetTenantIds(
    sourceTenantId: UUIDType,
    targetTenantIds: UUIDType[],
  ): Promise<UUIDType[]> {
    return this.courseTransferRelationshipRepository.findEligibleTargetTenantIds(
      sourceTenantId,
      targetTenantIds,
    );
  }

  async findTransferStatus(
    operationId: string,
    kind: CourseTransferKind,
  ): Promise<CourseTransferJobStatus | null> {
    return this.courseTransferCoordinator.findTransferStatus(operationId, kind);
  }

  private async claimRelationshipForExport(
    pair: CourseTransferRelationshipPair,
    transaction: DatabasePg,
  ): Promise<{ relationship: CourseTransferRelationship; isClaimed: boolean }> {
    const existingRelationship = await this.courseTransferRelationshipRepository.findByPair(
      pair,
      transaction,
    );
    if (existingRelationship) {
      return {
        relationship: existingRelationship,
        isClaimed: await this.reopenRelationship(existingRelationship, transaction),
      };
    }

    const { relationship, created } =
      await this.courseTransferRelationshipService.findOrCreateRelationship(pair, transaction);
    if (created) return { relationship, isClaimed: true };

    return { relationship, isClaimed: await this.reopenRelationship(relationship, transaction) };
  }

  private async reopenRelationship(
    relationship: CourseTransferRelationship,
    transaction: DatabasePg,
  ): Promise<boolean> {
    await this.courseTransferCoordinator.lockStream(this.toStreamKey(relationship), transaction);
    return this.courseTransferRelationshipRepository.claimRetry(
      relationship.kind,
      relationship.id,
      transaction,
    );
  }

  private async findRelationshipForJob(job: CourseTransferJob) {
    const relationshipById = job.exportId
      ? await this.courseTransferRelationshipRepository.findById(job.kind, job.exportId)
      : undefined;
    const relationship =
      relationshipById ?? (await this.courseTransferRelationshipRepository.findByPair(job));
    const errors = COURSE_TRANSFER_RELATIONSHIP_ERRORS[job.kind];

    if (!relationship) throw new NotFoundException(errors.missing);
    if (
      relationship.sourceId !== job.sourceId ||
      relationship.sourceTenantId !== job.sourceTenantId ||
      relationship.targetTenantId !== job.targetTenantId
    ) {
      throw new BadRequestException(errors.invalidJob);
    }

    return relationship;
  }

  private transferRelationshipUnderLease(
    relationship: CourseTransferRelationship,
    operationId: string,
  ): Promise<UUIDType | null> {
    return this.courseTransferCoordinator.transferUnderLease(
      operationId,
      (leasedTransfer) =>
        match(relationship.kind)
          .with(COURSE_TRANSFER_KINDS.COURSE, () =>
            this.transferCourseToDestination(relationship, leasedTransfer),
          )
          .with(COURSE_TRANSFER_KINDS.LEARNING_PATH, () =>
            this.transferLearningPathToDestination(relationship, leasedTransfer),
          )
          .exhaustive(),
      this.toStreamKey(relationship),
    );
  }

  private async transferCourseToDestination(
    leasedRelationship: CourseTransferRelationship,
    leasedTransfer: CourseTransferLeasedTransfer,
  ): Promise<UUIDType> {
    const relationship = await this.courseTransferRelationshipService.getRelationship(
      leasedRelationship.kind,
      leasedRelationship.id,
    );
    this.courseTransferRelationshipService.assertRelationshipIsActive(relationship);

    const snapshot = await this.courseTransferSnapshotService.readCourse({
      tenantId: relationship.sourceTenantId,
      courseId: relationship.sourceId,
    });
    const policy: CourseTransferSyncPolicy = {
      mode: COURSE_TRANSFER_MODES.SYNC,
      exportId: relationship.id,
    };
    const preparedCourse = await this.courseTransferAssetService.prepareCourse({
      snapshot,
      sourceTenantId: relationship.sourceTenantId,
      destination: {
        tenantId: relationship.targetTenantId,
        courseId: await this.courseTransferMaterializerService.resolveSyncTargetCourseId(
          relationship,
          snapshot.course.id,
        ),
      },
      policy,
    });

    return this.writeInDestinationTenant(relationship, leasedTransfer, (transaction) =>
      this.courseTransferMaterializerService.syncCourse(preparedCourse, policy, transaction),
    );
  }

  /**
   * Links the path's courses in one destination commit. Courses without a destination yet are
   * requested as their own transfers first, and the path waits until they are applied.
   */
  private async transferLearningPathToDestination(
    relationship: CourseTransferRelationship,
    leasedTransfer: CourseTransferLeasedTransfer,
  ): Promise<UUIDType | null> {
    const snapshot = await this.courseTransferSnapshotService.readLearningPath({
      tenantId: relationship.sourceTenantId,
      learningPathId: relationship.sourceId,
    });
    if (!snapshot) throw new NotFoundException(LEARNING_PATH_ERRORS.EXPORT_SOURCE_NOT_FOUND);
    if (!snapshot.courseLinks.length) {
      throw new BadRequestException(LEARNING_PATH_ERRORS.EXPORT_NO_COURSES);
    }

    const courses: CourseTransferPreparedLearningPathCourse[] = [];
    const pendingCourseTransfers: CourseTransferDependency[] = [];

    for (const { courseId } of snapshot.courseLinks) {
      const courseTransfer = await this.findOrRequestCourseOfLearningPath({
        kind: COURSE_TRANSFER_KINDS.COURSE,
        sourceTenantId: relationship.sourceTenantId,
        sourceId: courseId,
        targetTenantId: relationship.targetTenantId,
      });

      if (courseTransfer.dependency) pendingCourseTransfers.push(courseTransfer.dependency);
      else courses.push({ sourceCourseId: courseId, targetCourseId: courseTransfer.targetId });
    }

    if (pendingCourseTransfers.length) {
      return leasedTransfer.waitForDependencies(pendingCourseTransfers);
    }

    return this.writeInDestinationTenant(relationship, leasedTransfer, (transaction) =>
      this.courseTransferMaterializerService.syncLearningPath(
        {
          exportId: relationship.id,
          sourceTenantId: relationship.sourceTenantId,
          targetTenantId: relationship.targetTenantId,
          snapshot,
          courses,
        },
        transaction,
      ),
    );
  }

  private async findOrRequestCourseOfLearningPath(
    pair: CourseTransferRelationshipPair,
  ): Promise<CourseTransferTargetOrDependency> {
    return this.tenantDbRunnerService.runWithTenant(pair.sourceTenantId, () =>
      this.tenantDbRunnerService.transactionWithHandle(async (transaction) => {
        const sourceCourse = await this.courseTransferSnapshotService.findSourceCourse(
          pair.sourceId,
        );
        if (!sourceCourse) throw new NotFoundException("masterCourse.error.sourceCourseNotFound");
        if (sourceCourse.originType === COURSE_ORIGIN_TYPES.EXPORTED) {
          throw new BadRequestException("masterCourse.error.exportedCourseCannotBeSource");
        }

        await this.courseTransferRelationshipRepository.markSourceAsMaster(
          pair.kind,
          pair.sourceId,
          transaction,
        );
        const { relationship } =
          await this.courseTransferRelationshipService.findOrCreateRelationship(pair, transaction);
        this.courseTransferRelationshipService.assertRelationshipIsActive(relationship);

        return this.courseTransferCoordinator.findOrRequestTransferTarget(
          this.buildTransferRequest(relationship, {
            triggerEventType: COURSE_TRANSFER_TRIGGERS.LEARNING_PATH,
          }),
          pair.sourceId,
          transaction,
        );
      }),
    );
  }

  private writeInDestinationTenant(
    relationship: CourseTransferRelationship,
    leasedTransfer: CourseTransferLeasedTransfer,
    writeDestination: (transaction: DatabasePg) => Promise<UUIDType>,
  ): Promise<UUIDType> {
    return this.tenantDbRunnerService.runWithTenant(relationship.targetTenantId, () =>
      this.tenantDbRunnerService.transactionWithHandle((transaction) =>
        leasedTransfer.commitDestinationWrite(transaction, async () => {
          await this.courseTransferRelationshipService.lockActiveRelationshipForWrite(
            relationship,
            transaction,
          );
          const targetId = await writeDestination(transaction);
          await this.courseTransferRelationshipRepository.markSynced(
            relationship.kind,
            relationship.id,
            targetId,
            transaction,
          );
          return targetId;
        }),
      ),
    );
  }

  private async readCourseToCopy(courseId: UUIDType) {
    const sourceCourse = await this.courseTransferSnapshotService.findSourceCourse(courseId);
    if (!sourceCourse) throw new NotFoundException("courseDuplication.error.sourceCourseNotFound");

    const snapshot = await this.courseTransferSnapshotService.buildSourceSnapshot(sourceCourse);
    if (!snapshot) throw new NotFoundException("courseDuplication.error.sourceCategoryMissing");

    return snapshot;
  }

  private hasValidRelationshipIds(relationship: CourseTransferRelationshipRef) {
    return Value.Check(courseTransferRelationshipRefSchema, relationship);
  }

  private hasValidJobIds(job: CourseTransferJob) {
    return Value.Check(courseTransferJobSchema, job) && job.sourceTenantId !== job.targetTenantId;
  }

  private buildTransferRequest(
    relationship: CourseTransferRelationshipRef,
    details: { triggerEventType: string; actorId?: UUIDType },
  ): CourseTransferRequest {
    const { sourceIdKey } = COURSE_TRANSFER_JOB_TARGETS[relationship.kind];

    return {
      ...this.toStreamKey(relationship),
      payload: {
        exportId: relationship.id,
        [sourceIdKey]: relationship.sourceId,
        sourceTenantId: relationship.sourceTenantId,
        targetTenantId: relationship.targetTenantId,
        ...details,
      },
    };
  }

  private toStreamKey(relationship: CourseTransferRelationshipRef): CourseTransferStreamKey {
    return {
      kind: relationship.kind,
      exportId: relationship.id,
      sourceTenantId: relationship.sourceTenantId,
      targetTenantId: relationship.targetTenantId,
    };
  }
}
