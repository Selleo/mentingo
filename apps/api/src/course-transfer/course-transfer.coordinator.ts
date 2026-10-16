import { randomUUID } from "node:crypto";

import { Injectable, Logger } from "@nestjs/common";
import { MASTER_COURSE_EXPORT_SYNC_STATUSES } from "@repo/shared";
import { Value } from "@sinclair/typebox/value";
import { match } from "ts-pattern";

import { UUIDSchema } from "src/common";
import { LEARNING_PATH_ERRORS } from "src/learning-path/constants/learning-path.errors";
import { OutboxPublisher } from "src/outbox/outbox.publisher";
import { dbAls } from "src/storage/db/db-als.store";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import {
  COURSE_TRANSFER_CLAIM_OUTCOMES,
  COURSE_TRANSFER_DEPENDENCY_STATES,
  COURSE_TRANSFER_ERROR_CODES,
  COURSE_TRANSFER_HEARTBEAT_MS,
  COURSE_TRANSFER_JOB_STATES,
  COURSE_TRANSFER_MAX_ATTEMPTS,
  COURSE_TRANSFER_STATUSES,
} from "./course-transfer.constants";
import {
  CourseTransferBusyError,
  CourseTransferFailedError,
  CourseTransferLeaseLostError,
} from "./course-transfer.errors";
import { CourseTransferRequestedEvent } from "./events/course-transfer-requested.event";
import { CourseTransferRelationshipRepository } from "./repositories/course-transfer-relationship.repository";
import { CourseTransferStreamRepository } from "./repositories/course-transfer-stream.repository";
import { courseTransferStreamKeySchema } from "./schemas/course-transfer.schema";
import { CourseTransferRelationshipService } from "./services/course-transfer-relationship.service";

import type {
  CourseTransferClaim,
  CourseTransferDependency,
  CourseTransferDependencyState,
  CourseTransferErrorCode,
  CourseTransferJobStatus,
  CourseTransferKind,
  CourseTransferLease,
  CourseTransferLeasedTransfer,
  CourseTransferOperationRecord,
  CourseTransferRequest,
  CourseTransferStatus,
  CourseTransferStreamKey,
  CourseTransferStreamRecord,
  CourseTransferTargetOrDependency,
} from "./course-transfer.types";
import type { DatabasePg } from "src/common";

/**
 * Keeps transfers durable: every request becomes a revisioned operation, only one worker may
 * hold a stream's lease, and a destination write commits together with its operation.
 */
@Injectable()
export class CourseTransferCoordinator {
  private readonly logger = new Logger(CourseTransferCoordinator.name);

  constructor(
    private readonly courseTransferStreamRepository: CourseTransferStreamRepository,
    private readonly courseTransferRelationshipRepository: CourseTransferRelationshipRepository,
    private readonly courseTransferRelationshipService: CourseTransferRelationshipService,
    private readonly outboxPublisher: OutboxPublisher,
    private readonly tenantDbRunnerService: TenantDbRunnerService,
  ) {}

  async lockStream(streamKey: CourseTransferStreamKey, transaction: DatabasePg): Promise<void> {
    this.assertSourceTenantTransaction(streamKey.sourceTenantId, transaction);
    await this.lockStreamForKey(streamKey, transaction);
  }

  /** Records a new transfer revision and publishes it for dispatch once the transaction commits. */
  async recordTransferRequest(request: CourseTransferRequest, transaction?: DatabasePg) {
    if (
      !Value.Check(courseTransferStreamKeySchema, request) ||
      request.sourceTenantId === request.targetTenantId
    ) {
      throw new Error("Invalid transfer relationship");
    }

    const recordAndPublish = async (handle: DatabasePg) => {
      const stream = await this.lockStreamForKey(request, handle);
      const revision = stream.requestedRevision + 1;
      const operation = await this.courseTransferStreamRepository.insertOperation(
        { streamId: stream.id, revision, payload: request.payload },
        handle,
      );
      await this.courseTransferStreamRepository.markRevisionRequested(
        stream.id,
        revision,
        operation.id,
        handle,
      );
      await this.publishTransferRequested(operation.id, request.sourceTenantId, handle);
      return operation;
    };

    if (!transaction) {
      return this.tenantDbRunnerService.runWithTenant(request.sourceTenantId, () =>
        this.tenantDbRunnerService.transactionWithHandle(recordAndPublish),
      );
    }

    this.assertSourceTenantTransaction(request.sourceTenantId, transaction);
    return recordAndPublish(transaction);
  }

  /**
   * Returns the destination of a transfer that already has one. Otherwise makes sure a transfer
   * is requested and returns it as a dependency the caller can wait for.
   */
  async findOrRequestTransferTarget(
    request: CourseTransferRequest,
    sourceId: string,
    transaction: DatabasePg,
  ): Promise<CourseTransferTargetOrDependency> {
    this.assertSourceTenantTransaction(request.sourceTenantId, transaction);

    const stream = await this.lockStreamForKey(request, transaction);
    if (stream.targetId) return { targetId: stream.targetId };

    const latestOperation = stream.latestOperationId
      ? await this.courseTransferStreamRepository.findOperationById(
          stream.latestOperationId,
          transaction,
        )
      : undefined;

    const hasOutstandingRequest =
      stream.requestedRevision > stream.appliedRevision &&
      latestOperation?.status !== COURSE_TRANSFER_STATUSES.FAILED;

    const requiredRevision = hasOutstandingRequest
      ? stream.requestedRevision
      : (await this.recordTransferRequest(request, transaction)).revision;

    return { dependency: { streamId: stream.id, requiredRevision, sourceId } };
  }

  /**
   * Decides whether a requested operation should reach a worker. A paused or deleted sharing
   * relationship fails its unfinished operations instead, so recovery stops retrying them.
   */
  async isOperationDispatchable(operationId: string): Promise<boolean> {
    const record = await this.courseTransferStreamRepository.findOperationWithStream(operationId);
    if (!record) return false;

    return this.courseTransferStreamRepository.inTransaction(async (transaction) => {
      const locked = await this.courseTransferStreamRepository.findStreamForUpdate(
        record.stream.id,
        transaction,
      );
      if (!locked || locked.stream.appliedRevision === locked.stream.requestedRevision) {
        return false;
      }

      const relationshipStatus = await this.courseTransferRelationshipRepository.findStreamStatus(
        locked.stream,
        transaction,
      );
      if (relationshipStatus && relationshipStatus !== MASTER_COURSE_EXPORT_SYNC_STATUSES.PAUSED) {
        return true;
      }

      await this.courseTransferStreamRepository.failUnfinishedOperations(
        locked.stream.id,
        relationshipStatus
          ? COURSE_TRANSFER_ERROR_CODES.RELATIONSHIP_PAUSED
          : COURSE_TRANSFER_ERROR_CODES.RELATIONSHIP_MISSING,
        transaction,
      );
      await this.courseTransferStreamRepository.clearLease(locked.stream.id, transaction);
      await this.courseTransferStreamRepository.markWaitingDependentsDueForRecovery(
        locked.stream.id,
        transaction,
      );
      return false;
    });
  }

  /**
   * Transfers an operation while holding its stream lease, renewing the lease in the background.
   * The transfer receives the leased transfer and must write its destination through
   * `leasedTransfer.commitDestinationWrite`, or park itself with
   * `leasedTransfer.waitForDependencies`; a failure releases the lease for a later retry.
   * Resolves to null while the operation waits for its dependencies.
   */
  async transferUnderLease(
    operationId: string,
    transferToDestination: (leasedTransfer: CourseTransferLeasedTransfer) => Promise<string | null>,
    expectedStreamKey?: CourseTransferStreamKey,
  ): Promise<string | null> {
    const claim = await this.claimLease(operationId, expectedStreamKey);
    if (claim.outcome === COURSE_TRANSFER_CLAIM_OUTCOMES.ALREADY_APPLIED) return claim.targetId;
    if (claim.outcome === COURSE_TRANSFER_CLAIM_OUTCOMES.WAITING_FOR_DEPENDENCIES) return null;

    const { lease } = claim;

    let committedTargetId: string | undefined;
    let isWaitingForDependencies = false;

    const leasedTransfer: CourseTransferLeasedTransfer = {
      commitDestinationWrite: async (transaction, writeDestination) => {
        committedTargetId = await this.commitDestinationWrite(lease, transaction, writeDestination);
        return committedTargetId;
      },
      waitForDependencies: async (dependencies) => {
        await this.parkUntilDependenciesApply(lease, dependencies);
        isWaitingForDependencies = true;
        return null;
      },
    };

    const stopRenewingLease = this.keepLeaseRenewed(lease);

    try {
      const targetId = await transferToDestination(leasedTransfer);
      const finishedThroughLease =
        targetId === null ? isWaitingForDependencies : committedTargetId === targetId;

      if (!finishedThroughLease) {
        throw new Error("A transfer must finish through its leased transfer");
      }
      return targetId;
    } catch (error) {
      await this.releaseLeaseAfterFailure(lease).catch(() => {
        this.logger.error(`Could not record failure for transfer operation ${lease.operationId}`);
      });
      throw error;
    } finally {
      await stopRenewingLease();
    }
  }

  async findTransferStatus(
    operationId: string,
    kind: CourseTransferKind,
  ): Promise<CourseTransferJobStatus | null> {
    if (!Value.Check(UUIDSchema, operationId)) return null;

    const record = await this.courseTransferStreamRepository.findOperationWithStream(operationId);
    if (
      !record ||
      record.stream.kind !== kind ||
      record.stream.sourceTenantId !== dbAls.getStore()?.tenantId
    ) {
      return null;
    }

    const { operation } = record;
    return {
      id: operation.id,
      name: `${kind}-transfer`,
      state: this.toJobState(operation.status),
      attemptsMade: operation.attemptCount,
      failedReason:
        operation.status === COURSE_TRANSFER_STATUSES.FAILED
          ? this.toFailedReason(operation.errorCode)
          : null,
    };
  }

  /**
   * Re-publishes transfers whose lease lapsed before their revision was applied. Claiming pushes
   * each stream's next recovery time, so a failed publish is retried by a later run.
   */
  async redispatchStalledTransfers(): Promise<number> {
    const stalledStreams = await this.courseTransferStreamRepository.inTransaction(
      async (transaction) => {
        const streams =
          await this.courseTransferStreamRepository.findStalledStreamsForUpdate(transaction);
        for (const { streamId } of streams) {
          await this.courseTransferStreamRepository.postponeRecovery(streamId, transaction);
        }
        return streams;
      },
    );

    for (const { operationId, sourceTenantId } of stalledStreams) {
      await this.tenantDbRunnerService.runWithTenant(sourceTenantId, () =>
        this.tenantDbRunnerService.transactionWithHandle((transaction) =>
          this.publishTransferRequested(operationId, sourceTenantId, transaction),
        ),
      );
    }

    return stalledStreams.length;
  }

  private async lockStreamForKey(streamKey: CourseTransferStreamKey, transaction: DatabasePg) {
    await this.courseTransferStreamRepository.insertStreamIfMissing(streamKey, transaction);
    const stream = await this.courseTransferStreamRepository.findStreamByKeyForUpdate(
      streamKey,
      transaction,
    );

    if (
      !stream ||
      stream.sourceTenantId !== streamKey.sourceTenantId ||
      stream.targetTenantId !== streamKey.targetTenantId
    ) {
      throw new Error("Transfer relationship does not match its tenant authority");
    }

    return stream;
  }

  /**
   * Claims the stream's latest operation for one worker. Reports instead when the latest
   * revision is already applied or still waits for its dependencies, and fails the stream once
   * attempts run out or a dependency failed.
   */
  private async claimLease(
    operationId: string,
    expectedStreamKey?: CourseTransferStreamKey,
  ): Promise<CourseTransferClaim> {
    const claim = await this.courseTransferStreamRepository.inTransaction((transaction) =>
      this.claimLatestOperation(operationId, expectedStreamKey, transaction),
    );

    if (claim instanceof CourseTransferFailedError) throw claim;
    return claim;
  }

  private async claimLatestOperation(
    operationId: string,
    expectedStreamKey: CourseTransferStreamKey | undefined,
    transaction: DatabasePg,
  ): Promise<CourseTransferClaim | CourseTransferFailedError> {
    const { stream, leaseIsLive } = await this.lockStreamOfOperation(
      operationId,
      expectedStreamKey,
      transaction,
    );

    if (stream.targetId && stream.appliedRevision === stream.requestedRevision) {
      return { outcome: COURSE_TRANSFER_CLAIM_OUTCOMES.ALREADY_APPLIED, targetId: stream.targetId };
    }
    if (leaseIsLive) throw new CourseTransferBusyError();

    const latestOperation = await this.findLatestOperation(stream, transaction);
    if (latestOperation.status === COURSE_TRANSFER_STATUSES.FAILED) {
      throw new CourseTransferFailedError();
    }

    const dependencyState = await this.findDependencyState(latestOperation, transaction);

    return match(dependencyState)
      .with(COURSE_TRANSFER_DEPENDENCY_STATES.FAILED, () =>
        this.failStream(stream, COURSE_TRANSFER_ERROR_CODES.DEPENDENCY_FAILED, transaction),
      )
      .with(COURSE_TRANSFER_DEPENDENCY_STATES.PENDING, () => ({
        outcome: COURSE_TRANSFER_CLAIM_OUTCOMES.WAITING_FOR_DEPENDENCIES,
      }))
      .with(COURSE_TRANSFER_DEPENDENCY_STATES.APPLIED, () =>
        this.startAttempt(stream, latestOperation, transaction),
      )
      .exhaustive();
  }

  private async lockStreamOfOperation(
    operationId: string,
    expectedStreamKey: CourseTransferStreamKey | undefined,
    transaction: DatabasePg,
  ) {
    const operation = await this.courseTransferStreamRepository.findOperationById(
      operationId,
      transaction,
    );
    if (!operation) throw new Error("Transfer operation was not found");

    const locked = await this.courseTransferStreamRepository.findStreamForUpdate(
      operation.streamId,
      transaction,
    );
    if (!locked) throw new Error("Transfer relationship was not found");
    if (expectedStreamKey && !this.streamMatchesKey(locked.stream, expectedStreamKey)) {
      throw new Error("Transfer operation does not match its sharing relationship");
    }

    return locked;
  }

  private async findLatestOperation(
    stream: CourseTransferStreamRecord,
    transaction: DatabasePg,
  ): Promise<CourseTransferOperationRecord> {
    const latestOperation = stream.latestOperationId
      ? await this.courseTransferStreamRepository.findOperationById(
          stream.latestOperationId,
          transaction,
        )
      : undefined;
    if (!latestOperation) throw new Error("Transfer relationship has no operation");

    return latestOperation;
  }

  /** An operation that waits for nothing counts as having its dependencies applied. */
  private async findDependencyState(
    operation: CourseTransferOperationRecord,
    transaction: DatabasePg,
  ): Promise<CourseTransferDependencyState> {
    if (operation.status !== COURSE_TRANSFER_STATUSES.WAITING_FOR_DEPENDENCIES) {
      return COURSE_TRANSFER_DEPENDENCY_STATES.APPLIED;
    }

    const dependencies = await this.courseTransferStreamRepository.findDependencyStates(
      operation.id,
      transaction,
    );
    const pendingDependencies = dependencies.filter(
      ({ appliedRevision, requiredRevision }) => appliedRevision < requiredRevision,
    );

    if (
      pendingDependencies.some(
        ({ latestOperationStatus }) => latestOperationStatus === COURSE_TRANSFER_STATUSES.FAILED,
      )
    ) {
      return COURSE_TRANSFER_DEPENDENCY_STATES.FAILED;
    }

    return pendingDependencies.length
      ? COURSE_TRANSFER_DEPENDENCY_STATES.PENDING
      : COURSE_TRANSFER_DEPENDENCY_STATES.APPLIED;
  }

  /** Grants the lease for one more attempt, or fails the stream once attempts run out. */
  private async startAttempt(
    stream: CourseTransferStreamRecord,
    operation: CourseTransferOperationRecord,
    transaction: DatabasePg,
  ): Promise<CourseTransferClaim | CourseTransferFailedError> {
    if (operation.attemptCount >= COURSE_TRANSFER_MAX_ATTEMPTS) {
      return this.failStream(stream, COURSE_TRANSFER_ERROR_CODES.TRANSFER_FAILED, transaction);
    }

    const token = randomUUID();
    await this.courseTransferStreamRepository.grantLease(stream.id, token, transaction);
    await this.courseTransferStreamRepository.startOperationAttempt(operation.id, transaction);
    await this.courseTransferRelationshipService.markRelationshipProcessing(
      stream.kind,
      stream.exportId,
      transaction,
    );

    return {
      outcome: COURSE_TRANSFER_CLAIM_OUTCOMES.LEASED,
      lease: {
        streamId: stream.id,
        kind: stream.kind,
        exportId: stream.exportId,
        operationId: operation.id,
        revision: stream.requestedRevision,
        token,
        sourceTenantId: stream.sourceTenantId,
        targetTenantId: stream.targetTenantId,
      },
    };
  }

  /** Returned rather than thrown, so the terminal state commits before the worker sees it. */
  private async failStream(
    stream: CourseTransferStreamKey & { id: string },
    errorCode: CourseTransferErrorCode,
    transaction: DatabasePg,
  ): Promise<CourseTransferFailedError> {
    await this.courseTransferStreamRepository.failUnfinishedOperations(
      stream.id,
      errorCode,
      transaction,
    );
    await this.courseTransferStreamRepository.clearLease(stream.id, transaction);
    await this.courseTransferRelationshipRepository.markFailed(
      stream.kind,
      stream.exportId,
      transaction,
    );
    await this.courseTransferStreamRepository.markWaitingDependentsDueForRecovery(
      stream.id,
      transaction,
    );
    return new CourseTransferFailedError();
  }

  /** Records what the operation waits for and releases its lease without spending an attempt. */
  private async parkUntilDependenciesApply(
    lease: CourseTransferLease,
    dependencies: CourseTransferDependency[],
  ) {
    await this.courseTransferStreamRepository.inTransaction(async (transaction) => {
      await this.lockLeaseForCommit(lease, transaction);
      await this.courseTransferStreamRepository.upsertDependencies(
        lease.operationId,
        dependencies,
        transaction,
      );
      await this.courseTransferStreamRepository.setOperationStatus(
        lease.operationId,
        COURSE_TRANSFER_STATUSES.WAITING_FOR_DEPENDENCIES,
        null,
        transaction,
      );
      await this.courseTransferStreamRepository.releaseLease(lease, transaction);
    });
  }

  /**
   * Writes the destination graph inside the destination tenant transaction and completes the
   * leased operation in that same transaction.
   */
  private async commitDestinationWrite(
    lease: CourseTransferLease,
    transaction: DatabasePg,
    writeDestination: () => Promise<string>,
  ): Promise<string> {
    const tenantContext = dbAls.getStore();
    if (tenantContext?.tenantId !== lease.targetTenantId || tenantContext.trx !== transaction) {
      throw new Error("Transfer application requires the destination tenant transaction");
    }

    await this.lockLeaseForCommit(lease, transaction);
    const targetId = await writeDestination();
    await this.completeLeasedOperation(lease, targetId, transaction);
    return targetId;
  }

  /**
   * Holds the stream row until the destination graph and the operation commit together, so an
   * expired lease cannot let a second writer in while the destination transaction is open.
   */
  private async lockLeaseForCommit(lease: CourseTransferLease, transaction: DatabasePg) {
    const leaseState = await this.courseTransferStreamRepository.findLeaseStateForUpdate(
      lease.streamId,
      transaction,
    );

    if (
      !leaseState ||
      leaseState.token !== lease.token ||
      !leaseState.leaseIsLive ||
      leaseState.appliedRevision >= lease.revision
    ) {
      throw new CourseTransferLeaseLostError();
    }
  }

  private async completeLeasedOperation(
    lease: CourseTransferLease,
    targetId: string,
    transaction: DatabasePg,
  ) {
    await this.courseTransferStreamRepository.completeOperation(
      lease.operationId,
      targetId,
      transaction,
    );
    await this.courseTransferStreamRepository.supersedeUnfinishedOperationsBefore(
      lease,
      targetId,
      transaction,
    );
    const stream = await this.courseTransferStreamRepository.markRevisionApplied(
      lease,
      targetId,
      transaction,
    );

    if (stream.requestedRevision > lease.revision) {
      await this.courseTransferRelationshipRepository.markPending(
        lease.kind,
        lease.exportId,
        transaction,
      );
    }

    await this.redispatchWaitingDependents(lease, transaction);
  }

  /** Re-publishes operations that only waited for this revision, in the same commit. */
  private async redispatchWaitingDependents(lease: CourseTransferLease, transaction: DatabasePg) {
    const dependents = await this.courseTransferStreamRepository.findWaitingDependents(
      lease.streamId,
      lease.revision,
      transaction,
    );

    for (const { operationId, sourceTenantId } of dependents) {
      await this.publishTransferRequested(operationId, sourceTenantId, transaction);
    }
  }

  /** Returns the operation to the queue for another attempt, or fails it once attempts run out. */
  private async releaseLeaseAfterFailure(lease: CourseTransferLease) {
    await this.courseTransferStreamRepository.inTransaction(async (transaction) => {
      const released = await this.courseTransferStreamRepository.releaseLease(lease, transaction);
      if (!released) return;

      const operation = await this.courseTransferStreamRepository.findOperationById(
        lease.operationId,
        transaction,
      );
      const attemptsExhausted = operation.attemptCount >= COURSE_TRANSFER_MAX_ATTEMPTS;
      await this.courseTransferStreamRepository.setOperationStatus(
        lease.operationId,
        attemptsExhausted ? COURSE_TRANSFER_STATUSES.FAILED : COURSE_TRANSFER_STATUSES.PENDING,
        COURSE_TRANSFER_ERROR_CODES.TRANSFER_FAILED,
        transaction,
      );

      if (!attemptsExhausted || released.latestOperationId !== lease.operationId) return;

      await this.courseTransferStreamRepository.failUnfinishedOperationsBefore(
        lease,
        COURSE_TRANSFER_ERROR_CODES.TRANSFER_FAILED,
        transaction,
      );
      await this.courseTransferRelationshipRepository.markFailed(
        lease.kind,
        lease.exportId,
        transaction,
      );
      await this.courseTransferStreamRepository.markWaitingDependentsDueForRecovery(
        lease.streamId,
        transaction,
      );
    });
  }

  private async publishTransferRequested(
    operationId: string,
    sourceTenantId: string,
    transaction: DatabasePg,
  ): Promise<void> {
    await this.outboxPublisher.publishDurable(
      new CourseTransferRequestedEvent(operationId, sourceTenantId),
      transaction,
    );
  }

  private keepLeaseRenewed(lease: CourseTransferLease): () => Promise<void> {
    let pendingRenewal: Promise<void> | undefined;
    const timer = setInterval(() => {
      if (pendingRenewal) return;

      pendingRenewal = this.courseTransferStreamRepository
        .renewLease(lease)
        .catch(() => {
          // The commit validates the persisted lease, so a failed renewal cannot authorize writes.
          this.logger.warn(`Could not renew transfer operation ${lease.operationId}`);
        })
        .finally(() => {
          pendingRenewal = undefined;
        });
    }, COURSE_TRANSFER_HEARTBEAT_MS);
    timer.unref();

    return async () => {
      clearInterval(timer);
      await pendingRenewal;
    };
  }

  private streamMatchesKey(
    stream: CourseTransferStreamKey,
    streamKey: CourseTransferStreamKey,
  ): boolean {
    return (
      stream.kind === streamKey.kind &&
      stream.exportId === streamKey.exportId &&
      stream.sourceTenantId === streamKey.sourceTenantId &&
      stream.targetTenantId === streamKey.targetTenantId
    );
  }

  private toJobState(status: CourseTransferStatus) {
    return match(status)
      .with(
        COURSE_TRANSFER_STATUSES.PENDING,
        COURSE_TRANSFER_STATUSES.WAITING_FOR_DEPENDENCIES,
        () => COURSE_TRANSFER_JOB_STATES.WAITING,
      )
      .with(COURSE_TRANSFER_STATUSES.PROCESSING, () => COURSE_TRANSFER_JOB_STATES.ACTIVE)
      .with(COURSE_TRANSFER_STATUSES.FAILED, () => COURSE_TRANSFER_JOB_STATES.FAILED)
      .with(
        COURSE_TRANSFER_STATUSES.COMPLETED,
        COURSE_TRANSFER_STATUSES.SUPERSEDED,
        () => COURSE_TRANSFER_JOB_STATES.COMPLETED,
      )
      .exhaustive();
  }

  private toFailedReason(errorCode: string | null) {
    return match(errorCode)
      .with(
        COURSE_TRANSFER_ERROR_CODES.DEPENDENCY_FAILED,
        () => LEARNING_PATH_ERRORS.EXPORT_COURSE_FAILED,
      )
      .otherwise(() => "masterCourse.error.transferFailed");
  }

  private assertSourceTenantTransaction(sourceTenantId: string, transaction: DatabasePg): void {
    const sourceContext = dbAls.getStore();

    if (sourceContext?.tenantId !== sourceTenantId || sourceContext.trx !== transaction) {
      throw new Error("Transfer submission requires the source tenant transaction");
    }
  }
}
