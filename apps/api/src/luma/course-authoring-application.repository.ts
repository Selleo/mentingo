/** Stores idempotency claims and delivery state for course-authoring applications within a tenant. */
import { ConflictException, Inject, Injectable } from "@nestjs/common";
import { and, eq, sql, isNull, asc, lt, inArray } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { DB } from "src/storage/db/db.providers";
import { courseAuthoringApplications, courseAuthoringStagedAssets } from "src/storage/schema";

import type { CourseAuthoringApplicationClaim } from "./course-authoring.types";
import type { UUIDType } from "src/common";
import type { CourseAuthoringApplicationResult } from "src/storage/schema/course-authoring.schema";

@Injectable()
/** Provides tenant-scoped persistence and idempotent application claims. */
export class CourseAuthoringApplicationRepository {
  /** Injects the tenant-scoped database used for claims and receipt state. */
  constructor(@Inject(DB) private readonly db: DatabasePg) {}

  /** Returns the committed result for an export when this tenant has applied it. */
  async findReceipt(courseId: UUIDType, exportId: UUIDType, tenantId: UUIDType) {
    const [record] = await this.db
      .select()
      .from(courseAuthoringApplications)
      .where(
        and(
          eq(courseAuthoringApplications.tenantId, tenantId),
          eq(courseAuthoringApplications.courseId, courseId),
          eq(courseAuthoringApplications.exportId, exportId),
        ),
      );
    return record?.result ?? null;
  }

  /** Registers an asset before upload so a worker crash leaves a reclaimable inventory row. */
  async recordStagedAsset(
    tenantId: UUIDType,
    sessionId: UUIDType,
    exportId: UUIDType,
    key: string,
  ) {
    await this.db
      .insert(courseAuthoringStagedAssets)
      .values({ tenantId, sessionId, exportId, storageKey: key })
      .onConflictDoUpdate({
        target: [courseAuthoringStagedAssets.tenantId, courseAuthoringStagedAssets.storageKey],
        set: { sessionId, exportId, updatedAt: new Date().toISOString() },
      });
  }

  /** Reads a bounded batch of aged objects never referenced by an atomic apply receipt. */
  async expiredStagedAssets(tenantId: UUIDType, before: Date) {
    return this.db
      .select({ id: courseAuthoringStagedAssets.id, key: courseAuthoringStagedAssets.storageKey })
      .from(courseAuthoringStagedAssets)
      .where(
        and(
          eq(courseAuthoringStagedAssets.tenantId, tenantId),
          isNull(courseAuthoringStagedAssets.appliedAt),
          lt(courseAuthoringStagedAssets.updatedAt, before.toISOString()),
        ),
      )
      .orderBy(asc(courseAuthoringStagedAssets.updatedAt))
      .limit(100);
  }

  /** Serializes deletion with an apply claim and keeps the row if storage deletion fails. */
  async cleanExpiredStagedAsset(
    tenantId: UUIDType,
    id: UUIDType,
    before: Date,
    deleteStorageObject: (key: string) => Promise<void>,
  ) {
    await this.db.transaction(async (transaction) => {
      const [asset] = await transaction
        .select()
        .from(courseAuthoringStagedAssets)
        .where(
          and(
            eq(courseAuthoringStagedAssets.tenantId, tenantId),
            eq(courseAuthoringStagedAssets.id, id),
            isNull(courseAuthoringStagedAssets.appliedAt),
            lt(courseAuthoringStagedAssets.updatedAt, before.toISOString()),
          ),
        )
        .for("update");
      if (!asset) return;
      await deleteStorageObject(asset.storageKey);
      await transaction
        .delete(courseAuthoringStagedAssets)
        .where(eq(courseAuthoringStagedAssets.id, id));
    });
  }

  /** Lists undelivered receipts for one session so a new export can wait safely. */
  async pendingSessionReceipts(tenantId: UUIDType, courseId: UUIDType, sessionId: UUIDType) {
    return this.db
      .select({
        exportId: courseAuthoringApplications.exportId,
        courseId: courseAuthoringApplications.courseId,
        sessionId: courseAuthoringApplications.sessionId,
        exportHash: courseAuthoringApplications.exportHash,
      })
      .from(courseAuthoringApplications)
      .where(
        and(
          eq(courseAuthoringApplications.tenantId, tenantId),
          eq(courseAuthoringApplications.courseId, courseId),
          eq(courseAuthoringApplications.sessionId, sessionId),
          isNull(courseAuthoringApplications.receiptDeliveredAt),
        ),
      )
      .limit(25);
  }

  /** Lists the oldest undelivered receipts for the periodic retry scan. */
  async pendingReceipts(tenantId: UUIDType) {
    return this.db
      .select({
        exportId: courseAuthoringApplications.exportId,
        courseId: courseAuthoringApplications.courseId,
        sessionId: courseAuthoringApplications.sessionId,
        exportHash: courseAuthoringApplications.exportHash,
      })
      .from(courseAuthoringApplications)
      .where(
        and(
          eq(courseAuthoringApplications.tenantId, tenantId),
          isNull(courseAuthoringApplications.receiptDeliveredAt),
        ),
      )
      .orderBy(asc(courseAuthoringApplications.createdAt))
      .limit(25);
  }

  /** Marks a receipt delivered only when its tenant, export, and hash still match. */
  async markDelivered(tenantId: UUIDType, exportId: UUIDType, exportHash: string) {
    await this.db
      .update(courseAuthoringApplications)
      .set({ receiptDeliveredAt: sql`now()` })
      .where(
        and(
          eq(courseAuthoringApplications.tenantId, tenantId),
          eq(courseAuthoringApplications.exportId, exportId),
          eq(courseAuthoringApplications.exportHash, exportHash),
        ),
      );
  }

  /** Serializes an export claim and commits native result plus idempotency record atomically. */
  async applyOnce(
    claim: CourseAuthoringApplicationClaim,
    apply: (transaction: DatabasePg) => Promise<CourseAuthoringApplicationResult>,
    stagedKeys: string[] = [],
  ) {
    return this.db.transaction(async (transaction) => {
      // The lock spans validation, writes and receipt; a failed transaction is safely retryable.
      await transaction.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`${claim.tenantId}:${claim.exportId}`}, 0))`,
      );
      const [existing] = await transaction
        .select()
        .from(courseAuthoringApplications)
        .where(
          and(
            eq(courseAuthoringApplications.tenantId, claim.tenantId),
            eq(courseAuthoringApplications.exportId, claim.exportId),
          ),
        );
      if (existing) {
        if (
          existing.exportHash !== claim.exportHash ||
          existing.courseId !== claim.courseId ||
          existing.sessionId !== claim.sessionId
        ) {
          throw new ConflictException("courseAuthoring.errors.exportIdentityConflict");
        }
        return existing.result;
      }
      if (stagedKeys.length) {
        const staged = await transaction
          .select({ key: courseAuthoringStagedAssets.storageKey })
          .from(courseAuthoringStagedAssets)
          .where(
            and(
              eq(courseAuthoringStagedAssets.tenantId, claim.tenantId),
              inArray(courseAuthoringStagedAssets.storageKey, stagedKeys),
            ),
          )
          .for("update");
        if (staged.length !== new Set(stagedKeys).size)
          throw new ConflictException("courseAuthoring.errors.applicationFailed");
      }
      const result = await apply(transaction);
      await transaction.insert(courseAuthoringApplications).values({ ...claim, result });
      const appliedKeys = Object.values(result.assetMappings);
      if (appliedKeys.length)
        await transaction
          .update(courseAuthoringStagedAssets)
          .set({ appliedAt: new Date().toISOString() })
          .where(
            and(
              eq(courseAuthoringStagedAssets.tenantId, claim.tenantId),
              inArray(courseAuthoringStagedAssets.storageKey, appliedKeys),
            ),
          );
      return result;
    });
  }
}
