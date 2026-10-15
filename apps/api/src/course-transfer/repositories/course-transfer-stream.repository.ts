import { Inject, Injectable } from "@nestjs/common";
import { and, eq, inArray, lt, lte, ne, or, sql } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { DB_ADMIN } from "src/storage/db/db.providers";
import {
  courseTransferDependencies,
  courseTransferOperations,
  courseTransferStreams,
} from "src/storage/schema";

import {
  COURSE_TRANSFER_LEASE_SECONDS,
  COURSE_TRANSFER_RECOVERY_SECONDS,
  COURSE_TRANSFER_STATUSES,
} from "../course-transfer.constants";

import type {
  CourseTransferDependency,
  CourseTransferErrorCode,
  CourseTransferLease,
  CourseTransferStatus,
  CourseTransferStreamKey,
} from "../course-transfer.types";

const UNFINISHED_OPERATION = inArray(courseTransferOperations.status, [
  COURSE_TRANSFER_STATUSES.PENDING,
  COURSE_TRANSFER_STATUSES.PROCESSING,
  COURSE_TRANSFER_STATUSES.WAITING_FOR_DEPENDENCIES,
]);
const LEASE_IS_LIVE = sql<boolean>`${courseTransferStreams.leaseExpiresAt} > clock_timestamp()`;
const LEASE_EXPIRY = sql`clock_timestamp() + ${COURSE_TRANSFER_LEASE_SECONDS} * interval '1 second'`;
const RECOVERY_DEADLINE = sql`clock_timestamp() + ${COURSE_TRANSFER_RECOVERY_SECONDS} * interval '1 second'`;

/**
 * Stores transfer streams (one per sharing relationship) and their revisioned operations.
 * A stream deliberately spans two tenants, so it is accessed through the admin handle.
 */
@Injectable()
export class CourseTransferStreamRepository {
  constructor(@Inject(DB_ADMIN) private readonly dbAdmin: DatabasePg) {}

  inTransaction<T>(callback: (transaction: DatabasePg) => Promise<T>): Promise<T> {
    return this.dbAdmin.transaction(callback);
  }

  async insertStreamIfMissing(streamKey: CourseTransferStreamKey, transaction: DatabasePg) {
    await transaction
      .insert(courseTransferStreams)
      .values({
        kind: streamKey.kind,
        exportId: streamKey.exportId,
        sourceTenantId: streamKey.sourceTenantId,
        targetTenantId: streamKey.targetTenantId,
      })
      .onConflictDoNothing();
  }

  async findStreamByKeyForUpdate(streamKey: CourseTransferStreamKey, transaction: DatabasePg) {
    const [stream] = await transaction
      .select()
      .from(courseTransferStreams)
      .where(
        and(
          eq(courseTransferStreams.kind, streamKey.kind),
          eq(courseTransferStreams.exportId, streamKey.exportId),
        ),
      )
      .for("update");

    return stream;
  }

  async findStreamForUpdate(streamId: string, transaction: DatabasePg) {
    const [stream] = await transaction
      .select({ stream: courseTransferStreams, leaseIsLive: LEASE_IS_LIVE })
      .from(courseTransferStreams)
      .where(eq(courseTransferStreams.id, streamId))
      .for("update");

    return stream;
  }

  async insertOperation(
    values: { streamId: string; revision: number; payload: Record<string, unknown> },
    transaction: DatabasePg,
  ) {
    const [operation] = await transaction
      .insert(courseTransferOperations)
      .values(values)
      .returning();

    return operation;
  }

  async markRevisionRequested(
    streamId: string,
    revision: number,
    operationId: string,
    transaction: DatabasePg,
  ) {
    await transaction
      .update(courseTransferStreams)
      .set({
        requestedRevision: revision,
        latestOperationId: operationId,
        nextRecoveryAt: RECOVERY_DEADLINE,
      })
      .where(eq(courseTransferStreams.id, streamId));
  }

  async findOperationWithStream(operationId: string) {
    const [record] = await this.dbAdmin
      .select({ operation: courseTransferOperations, stream: courseTransferStreams })
      .from(courseTransferOperations)
      .innerJoin(
        courseTransferStreams,
        eq(courseTransferOperations.streamId, courseTransferStreams.id),
      )
      .where(eq(courseTransferOperations.id, operationId));

    return record ?? null;
  }

  async findOperationById(operationId: string, transaction: DatabasePg) {
    const [operation] = await transaction
      .select()
      .from(courseTransferOperations)
      .where(eq(courseTransferOperations.id, operationId));

    return operation;
  }

  async grantLease(streamId: string, token: string, transaction: DatabasePg) {
    await transaction
      .update(courseTransferStreams)
      .set({ claimToken: token, leaseExpiresAt: LEASE_EXPIRY })
      .where(eq(courseTransferStreams.id, streamId));
  }

  async renewLease(lease: CourseTransferLease) {
    await this.dbAdmin
      .update(courseTransferStreams)
      .set({ leaseExpiresAt: LEASE_EXPIRY })
      .where(
        and(
          eq(courseTransferStreams.id, lease.streamId),
          eq(courseTransferStreams.claimToken, lease.token),
          LEASE_IS_LIVE,
        ),
      );
  }

  async clearLease(streamId: string, transaction: DatabasePg) {
    await transaction
      .update(courseTransferStreams)
      .set({ claimToken: null, leaseExpiresAt: null })
      .where(eq(courseTransferStreams.id, streamId));
  }

  async releaseLease(lease: CourseTransferLease, transaction: DatabasePg) {
    const [released] = await transaction
      .update(courseTransferStreams)
      .set({ claimToken: null, leaseExpiresAt: null })
      .where(
        and(
          eq(courseTransferStreams.id, lease.streamId),
          eq(courseTransferStreams.claimToken, lease.token),
        ),
      )
      .returning({ latestOperationId: courseTransferStreams.latestOperationId });

    return released;
  }

  async findLeaseStateForUpdate(streamId: string, transaction: DatabasePg) {
    const [leaseState] = await transaction
      .select({
        token: courseTransferStreams.claimToken,
        appliedRevision: courseTransferStreams.appliedRevision,
        leaseIsLive: LEASE_IS_LIVE,
      })
      .from(courseTransferStreams)
      .where(eq(courseTransferStreams.id, streamId))
      .for("update");

    return leaseState;
  }

  async startOperationAttempt(operationId: string, transaction: DatabasePg) {
    await transaction
      .update(courseTransferOperations)
      .set({
        status: COURSE_TRANSFER_STATUSES.PROCESSING,
        attemptCount: sql`${courseTransferOperations.attemptCount} + 1`,
        errorCode: null,
      })
      .where(eq(courseTransferOperations.id, operationId));
  }

  async setOperationStatus(
    operationId: string,
    status: CourseTransferStatus,
    errorCode: CourseTransferErrorCode | null,
    transaction: DatabasePg,
  ) {
    await transaction
      .update(courseTransferOperations)
      .set({ status, errorCode })
      .where(eq(courseTransferOperations.id, operationId));
  }

  async completeOperation(operationId: string, targetId: string, transaction: DatabasePg) {
    await transaction
      .update(courseTransferOperations)
      .set({
        status: COURSE_TRANSFER_STATUSES.COMPLETED,
        targetId,
        completedAt: sql`clock_timestamp()`,
        errorCode: null,
      })
      .where(eq(courseTransferOperations.id, operationId));
  }

  async supersedeUnfinishedOperationsBefore(
    lease: CourseTransferLease,
    targetId: string,
    transaction: DatabasePg,
  ) {
    await transaction
      .update(courseTransferOperations)
      .set({
        status: COURSE_TRANSFER_STATUSES.SUPERSEDED,
        targetId,
        completedAt: sql`clock_timestamp()`,
        errorCode: null,
      })
      .where(
        and(
          eq(courseTransferOperations.streamId, lease.streamId),
          lt(courseTransferOperations.revision, lease.revision),
          UNFINISHED_OPERATION,
        ),
      );
  }

  async failUnfinishedOperations(
    streamId: string,
    errorCode: CourseTransferErrorCode,
    transaction: DatabasePg,
  ) {
    await transaction
      .update(courseTransferOperations)
      .set({ status: COURSE_TRANSFER_STATUSES.FAILED, errorCode })
      .where(and(eq(courseTransferOperations.streamId, streamId), UNFINISHED_OPERATION));
  }

  async failUnfinishedOperationsBefore(
    lease: CourseTransferLease,
    errorCode: CourseTransferErrorCode,
    transaction: DatabasePg,
  ) {
    await transaction
      .update(courseTransferOperations)
      .set({ status: COURSE_TRANSFER_STATUSES.FAILED, errorCode })
      .where(
        and(
          eq(courseTransferOperations.streamId, lease.streamId),
          lt(courseTransferOperations.revision, lease.revision),
          UNFINISHED_OPERATION,
        ),
      );
  }

  async markRevisionApplied(lease: CourseTransferLease, targetId: string, transaction: DatabasePg) {
    const [stream] = await transaction
      .update(courseTransferStreams)
      .set({ appliedRevision: lease.revision, targetId, claimToken: null, leaseExpiresAt: null })
      .where(
        and(
          eq(courseTransferStreams.id, lease.streamId),
          eq(courseTransferStreams.claimToken, lease.token),
        ),
      )
      .returning({ requestedRevision: courseTransferStreams.requestedRevision });

    return stream;
  }

  async upsertDependencies(
    operationId: string,
    dependencies: CourseTransferDependency[],
    transaction: DatabasePg,
  ) {
    if (!dependencies.length) return;

    await transaction
      .insert(courseTransferDependencies)
      .values(
        dependencies.map((dependency) => ({
          operationId,
          dependencyStreamId: dependency.streamId,
          requiredRevision: dependency.requiredRevision,
          sourceId: dependency.sourceId,
        })),
      )
      .onConflictDoUpdate({
        target: [
          courseTransferDependencies.operationId,
          courseTransferDependencies.dependencyStreamId,
        ],
        set: { requiredRevision: sql`excluded.required_revision`, updatedAt: sql`now()` },
      });
  }

  async findDependencyStates(operationId: string, transaction: DatabasePg) {
    return transaction
      .select({
        sourceId: courseTransferDependencies.sourceId,
        requiredRevision: courseTransferDependencies.requiredRevision,
        appliedRevision: courseTransferStreams.appliedRevision,
        latestOperationStatus: courseTransferOperations.status,
      })
      .from(courseTransferDependencies)
      .innerJoin(
        courseTransferStreams,
        eq(courseTransferStreams.id, courseTransferDependencies.dependencyStreamId),
      )
      .leftJoin(
        courseTransferOperations,
        eq(courseTransferOperations.id, courseTransferStreams.latestOperationId),
      )
      .where(eq(courseTransferDependencies.operationId, operationId));
  }

  async findWaitingDependents(streamId: string, appliedRevision: number, transaction: DatabasePg) {
    return transaction
      .select({
        operationId: courseTransferOperations.id,
        sourceTenantId: courseTransferStreams.sourceTenantId,
      })
      .from(courseTransferDependencies)
      .innerJoin(
        courseTransferOperations,
        eq(courseTransferOperations.id, courseTransferDependencies.operationId),
      )
      .innerJoin(
        courseTransferStreams,
        eq(courseTransferStreams.id, courseTransferOperations.streamId),
      )
      .where(
        and(
          eq(courseTransferDependencies.dependencyStreamId, streamId),
          lte(courseTransferDependencies.requiredRevision, appliedRevision),
          eq(courseTransferOperations.status, COURSE_TRANSFER_STATUSES.WAITING_FOR_DEPENDENCIES),
        ),
      );
  }

  /** Lets the recovery run reach operations waiting on a stream whose transfer just failed. */
  async markWaitingDependentsDueForRecovery(streamId: string, transaction: DatabasePg) {
    const waitingStreamIds = transaction
      .select({ streamId: courseTransferOperations.streamId })
      .from(courseTransferDependencies)
      .innerJoin(
        courseTransferOperations,
        eq(courseTransferOperations.id, courseTransferDependencies.operationId),
      )
      .where(
        and(
          eq(courseTransferDependencies.dependencyStreamId, streamId),
          eq(courseTransferOperations.status, COURSE_TRANSFER_STATUSES.WAITING_FOR_DEPENDENCIES),
        ),
      );

    await transaction
      .update(courseTransferStreams)
      .set({ nextRecoveryAt: sql`clock_timestamp()` })
      .where(inArray(courseTransferStreams.id, waitingStreamIds));
  }

  async findStalledStreamsForUpdate(transaction: DatabasePg) {
    return transaction
      .select({
        streamId: courseTransferStreams.id,
        operationId: courseTransferOperations.id,
        sourceTenantId: courseTransferStreams.sourceTenantId,
      })
      .from(courseTransferStreams)
      .innerJoin(
        courseTransferOperations,
        eq(courseTransferStreams.latestOperationId, courseTransferOperations.id),
      )
      .where(
        and(
          sql`${courseTransferStreams.requestedRevision} > ${courseTransferStreams.appliedRevision}`,
          sql`${courseTransferStreams.nextRecoveryAt} <= clock_timestamp()`,
          or(
            sql`${courseTransferStreams.leaseExpiresAt} IS NULL`,
            sql`${courseTransferStreams.leaseExpiresAt} <= clock_timestamp()`,
          ),
          ne(courseTransferOperations.status, COURSE_TRANSFER_STATUSES.FAILED),
        ),
      )
      .limit(100)
      .for("update", { of: courseTransferStreams, skipLocked: true });
  }

  async postponeRecovery(streamId: string, transaction: DatabasePg) {
    await transaction
      .update(courseTransferStreams)
      .set({ nextRecoveryAt: RECOVERY_DEADLINE })
      .where(eq(courseTransferStreams.id, streamId));
  }
}
