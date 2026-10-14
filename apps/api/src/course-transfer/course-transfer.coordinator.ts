import { randomUUID } from "node:crypto";

import { Injectable, Logger } from "@nestjs/common";
import { MASTER_COURSE_EXPORT_SYNC_STATUSES } from "@repo/shared";
import { Value } from "@sinclair/typebox/value";
import { match } from "ts-pattern";

import { UUIDSchema } from "src/common";
import { OutboxPublisher } from "src/outbox/outbox.publisher";
import { dbAls } from "src/storage/db/db-als.store";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import {
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
  CourseTransferJobStatus,
  CourseTransferKind,
  CourseTransferLease,
  CourseTransferLeasedTransfer,
  CourseTransferRequest,
  CourseTransferStatus,
  CourseTransferStreamKey,
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
      return false;
    });
  }

  /**
   * Transfers an operation while holding its stream lease, renewing the lease in the background.
   * The transfer receives the leased transfer and must write its destination through
   * `leasedTransfer.commitDestinationWrite`; a failure releases the lease for a later retry.
   */
  async transferUnderLease(
    operationId: string,
    transferToDestination: (leasedTransfer: CourseTransferLeasedTransfer) => Promise<string>,
    expectedStreamKey?: CourseTransferStreamKey,
  ): Promise<string> {
    const lease = await this.claimLease(operationId, expectedStreamKey);
    if (typeof lease === "string") return lease;

    let committedTargetId: string | undefined;
    const leasedTransfer: CourseTransferLeasedTransfer = {
      commitDestinationWrite: async (transaction, writeDestination) => {
        committedTargetId = await this.commitDestinationWrite(lease, transaction, writeDestination);
        return committedTargetId;
      },
    };

    const stopRenewingLease = this.keepLeaseRenewed(lease);
    try {
      const targetId = await transferToDestination(leasedTransfer);
      if (committedTargetId !== targetId) {
        throw new Error("A transfer must commit its destination through its leased transfer");
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
          ? "masterCourse.error.transferFailed"
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
   * Claims the stream's latest operation for one worker. Returns the destination ID instead
   * when the latest revision is already applied, and fails the stream once attempts run out.
   */
  private async claimLease(
    operationId: string,
    expectedStreamKey?: CourseTransferStreamKey,
  ): Promise<CourseTransferLease | string> {
    const claim = await this.courseTransferStreamRepository.inTransaction(async (transaction) => {
      const requested = await this.courseTransferStreamRepository.findOperationById(
        operationId,
        transaction,
      );
      if (!requested) throw new Error("Transfer operation was not found");

      const locked = await this.courseTransferStreamRepository.findStreamForUpdate(
        requested.streamId,
        transaction,
      );
      if (!locked) throw new Error("Transfer relationship was not found");

      const { stream } = locked;
      if (expectedStreamKey && !this.streamMatchesKey(stream, expectedStreamKey)) {
        throw new Error("Transfer operation does not match its sharing relationship");
      }
      if (stream.appliedRevision === stream.requestedRevision && stream.targetId) {
        return stream.targetId;
      }
      if (locked.leaseIsLive) throw new CourseTransferBusyError();
      if (!stream.latestOperationId) throw new Error("Transfer relationship has no operation");

      const latest = await this.courseTransferStreamRepository.findOperationById(
        stream.latestOperationId,
        transaction,
      );
      if (latest?.status === COURSE_TRANSFER_STATUSES.FAILED) throw new CourseTransferFailedError();

      if (latest.attemptCount >= COURSE_TRANSFER_MAX_ATTEMPTS) {
        await this.courseTransferStreamRepository.failUnfinishedOperations(
          stream.id,
          COURSE_TRANSFER_ERROR_CODES.TRANSFER_FAILED,
          transaction,
        );
        await this.courseTransferStreamRepository.clearLease(stream.id, transaction);
        await this.courseTransferRelationshipRepository.markFailed(
          stream.kind,
          stream.exportId,
          transaction,
        );
        // Returned rather than thrown so the terminal state commits before the worker sees it.
        return new CourseTransferFailedError();
      }

      const token = randomUUID();
      await this.courseTransferStreamRepository.grantLease(stream.id, token, transaction);
      await this.courseTransferStreamRepository.startOperationAttempt(
        stream.latestOperationId,
        transaction,
      );
      await this.courseTransferRelationshipService.markRelationshipProcessing(
        stream.kind,
        stream.exportId,
        transaction,
      );

      return {
        streamId: stream.id,
        kind: stream.kind,
        exportId: stream.exportId,
        operationId: stream.latestOperationId,
        revision: stream.requestedRevision,
        token,
        sourceTenantId: stream.sourceTenantId,
        targetTenantId: stream.targetTenantId,
      };
    });

    if (claim instanceof CourseTransferFailedError) throw claim;
    return claim;
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
      .with(COURSE_TRANSFER_STATUSES.PENDING, () => COURSE_TRANSFER_JOB_STATES.WAITING)
      .with(COURSE_TRANSFER_STATUSES.PROCESSING, () => COURSE_TRANSFER_JOB_STATES.ACTIVE)
      .with(COURSE_TRANSFER_STATUSES.FAILED, () => COURSE_TRANSFER_JOB_STATES.FAILED)
      .with(
        COURSE_TRANSFER_STATUSES.COMPLETED,
        COURSE_TRANSFER_STATUSES.SUPERSEDED,
        () => COURSE_TRANSFER_JOB_STATES.COMPLETED,
      )
      .exhaustive();
  }

  private assertSourceTenantTransaction(sourceTenantId: string, transaction: DatabasePg): void {
    const sourceContext = dbAls.getStore();

    if (sourceContext?.tenantId !== sourceTenantId || sourceContext.trx !== transaction) {
      throw new Error("Transfer submission requires the source tenant transaction");
    }
  }
}
