import { Inject, Injectable } from "@nestjs/common";
import {
  COURSE_ORIGIN_TYPES,
  MASTER_COURSE_EXPORT_SYNC_STATUSES,
  TENANT_STATUSES,
} from "@repo/shared";
import {
  and,
  asc,
  count,
  eq,
  ilike,
  inArray,
  isNotNull,
  isNull,
  ne,
  notInArray,
  or,
  sql,
} from "drizzle-orm";
import { match } from "ts-pattern";

import { DatabasePg } from "src/common";
import { DB_ADMIN } from "src/storage/db/db.providers";
import {
  courses,
  learningPathExports,
  learningPaths,
  masterCourseExports,
  tenants,
} from "src/storage/schema";

import { COURSE_TRANSFER_KINDS } from "../course-transfer.constants";

import type {
  CourseTransferExportCandidatesQuery,
  CourseTransferKind,
  CourseTransferRelationship,
  CourseTransferRelationshipPair,
} from "../course-transfer.types";
import type { UUIDType } from "src/common";

const RELATIONSHIP_TABLES = {
  [COURSE_TRANSFER_KINDS.COURSE]: {
    table: masterCourseExports,
    sourceId: masterCourseExports.sourceCourseId,
    targetId: masterCourseExports.targetCourseId,
  },
  [COURSE_TRANSFER_KINDS.LEARNING_PATH]: {
    table: learningPathExports,
    sourceId: learningPathExports.sourceLearningPathId,
    targetId: learningPathExports.targetLearningPathId,
  },
} as const;

/**
 * Persists sharing relationships for every transfer kind. A relationship deliberately spans two
 * tenants, so it is read through the admin handle; callers authorize the pair before writing it.
 */
@Injectable()
export class CourseTransferRelationshipRepository {
  constructor(@Inject(DB_ADMIN) private readonly dbAdmin: DatabasePg) {}

  async findById(
    kind: CourseTransferKind,
    id: UUIDType,
    dbInstance: DatabasePg = this.dbAdmin,
  ): Promise<CourseTransferRelationship | undefined> {
    const relationships = RELATIONSHIP_TABLES[kind];
    const [relationship] = await dbInstance
      .select(this.selectRelationship(kind))
      .from(relationships.table)
      .where(eq(relationships.table.id, id))
      .limit(1);

    return relationship;
  }

  async findByPair(
    pair: CourseTransferRelationshipPair,
    dbInstance: DatabasePg = this.dbAdmin,
  ): Promise<CourseTransferRelationship | undefined> {
    const relationships = RELATIONSHIP_TABLES[pair.kind];
    const [relationship] = await dbInstance
      .select(this.selectRelationship(pair.kind))
      .from(relationships.table)
      .where(
        and(
          eq(relationships.table.sourceTenantId, pair.sourceTenantId),
          eq(relationships.sourceId, pair.sourceId),
          eq(relationships.table.targetTenantId, pair.targetTenantId),
        ),
      )
      .limit(1);

    return relationship;
  }

  async insertIfMissing(
    pair: CourseTransferRelationshipPair,
    dbInstance: DatabasePg = this.dbAdmin,
  ): Promise<boolean> {
    const common = {
      sourceTenantId: pair.sourceTenantId,
      targetTenantId: pair.targetTenantId,
      syncStatus: MASTER_COURSE_EXPORT_SYNC_STATUSES.PENDING,
    };
    const created = await match(pair.kind)
      .with(COURSE_TRANSFER_KINDS.COURSE, () =>
        dbInstance
          .insert(masterCourseExports)
          .values({ ...common, sourceCourseId: pair.sourceId })
          .onConflictDoNothing({
            target: [
              masterCourseExports.sourceTenantId,
              masterCourseExports.sourceCourseId,
              masterCourseExports.targetTenantId,
            ],
          })
          .returning({ id: masterCourseExports.id }),
      )
      .with(COURSE_TRANSFER_KINDS.LEARNING_PATH, () =>
        dbInstance
          .insert(learningPathExports)
          .values({ ...common, sourceLearningPathId: pair.sourceId })
          .onConflictDoNothing({
            target: [
              learningPathExports.sourceTenantId,
              learningPathExports.sourceLearningPathId,
              learningPathExports.targetTenantId,
            ],
          })
          .returning({ id: learningPathExports.id }),
      )
      .exhaustive();

    return created.length > 0;
  }

  /** Reopens a failed or never-applied relationship so a new export request may be recorded. */
  async claimRetry(
    kind: CourseTransferKind,
    id: UUIDType,
    dbInstance: DatabasePg = this.dbAdmin,
  ): Promise<boolean> {
    const relationships = RELATIONSHIP_TABLES[kind];
    const claimed = await dbInstance
      .update(relationships.table)
      .set({ syncStatus: MASTER_COURSE_EXPORT_SYNC_STATUSES.PENDING })
      .where(
        and(
          eq(relationships.table.id, id),
          or(
            eq(relationships.table.syncStatus, MASTER_COURSE_EXPORT_SYNC_STATUSES.FAILED),
            and(
              eq(relationships.table.syncStatus, MASTER_COURSE_EXPORT_SYNC_STATUSES.ACTIVE),
              or(isNull(relationships.targetId), isNull(relationships.table.lastSyncedAt)),
            ),
          ),
        ),
      )
      .returning({ id: relationships.table.id });

    return claimed.length > 0;
  }

  async markSourceAsMaster(
    kind: CourseTransferKind,
    sourceId: UUIDType,
    dbInstance: DatabasePg = this.dbAdmin,
  ): Promise<void> {
    await match(kind)
      .with(COURSE_TRANSFER_KINDS.COURSE, () =>
        dbInstance
          .update(courses)
          .set({ originType: COURSE_ORIGIN_TYPES.MASTER })
          .where(eq(courses.id, sourceId)),
      )
      .with(COURSE_TRANSFER_KINDS.LEARNING_PATH, () =>
        dbInstance
          .update(learningPaths)
          .set({ originType: COURSE_ORIGIN_TYPES.MASTER })
          .where(eq(learningPaths.id, sourceId)),
      )
      .exhaustive();
  }

  async findSyncStatusForUpdate(relationship: CourseTransferRelationship, transaction: DatabasePg) {
    const relationships = RELATIONSHIP_TABLES[relationship.kind];
    const [locked] = await transaction
      .select({ syncStatus: relationships.table.syncStatus })
      .from(relationships.table)
      .where(
        and(
          eq(relationships.table.id, relationship.id),
          eq(relationships.table.sourceTenantId, relationship.sourceTenantId),
          eq(relationships.sourceId, relationship.sourceId),
          eq(relationships.table.targetTenantId, relationship.targetTenantId),
        ),
      )
      .for("update");

    return locked?.syncStatus;
  }

  async findStreamStatus(
    stream: Pick<CourseTransferRelationship, "kind" | "sourceTenantId" | "targetTenantId"> & {
      exportId: string;
    },
    transaction: DatabasePg,
  ) {
    const relationships = RELATIONSHIP_TABLES[stream.kind];
    const [relationship] = await transaction
      .select({ syncStatus: relationships.table.syncStatus })
      .from(relationships.table)
      .where(
        and(
          eq(relationships.table.id, stream.exportId),
          eq(relationships.table.sourceTenantId, stream.sourceTenantId),
          eq(relationships.table.targetTenantId, stream.targetTenantId),
        ),
      );

    return relationship?.syncStatus;
  }

  async markPending(
    kind: CourseTransferKind,
    id: UUIDType,
    dbInstance: DatabasePg = this.dbAdmin,
  ): Promise<void> {
    const relationships = RELATIONSHIP_TABLES[kind];
    await dbInstance
      .update(relationships.table)
      .set({ syncStatus: MASTER_COURSE_EXPORT_SYNC_STATUSES.PENDING })
      .where(
        and(
          eq(relationships.table.id, id),
          notInArray(relationships.table.syncStatus, [
            MASTER_COURSE_EXPORT_SYNC_STATUSES.PROCESSING,
            MASTER_COURSE_EXPORT_SYNC_STATUSES.PAUSED,
          ]),
        ),
      );
  }

  async markProcessing(
    kind: CourseTransferKind,
    id: UUIDType,
    dbInstance: DatabasePg = this.dbAdmin,
  ): Promise<boolean> {
    const relationships = RELATIONSHIP_TABLES[kind];
    const updated = await dbInstance
      .update(relationships.table)
      .set({ syncStatus: MASTER_COURSE_EXPORT_SYNC_STATUSES.PROCESSING })
      .where(
        and(
          eq(relationships.table.id, id),
          ne(relationships.table.syncStatus, MASTER_COURSE_EXPORT_SYNC_STATUSES.PAUSED),
        ),
      )
      .returning({ id: relationships.table.id });

    return updated.length > 0;
  }

  async markFailed(
    kind: CourseTransferKind,
    id: UUIDType,
    dbInstance: DatabasePg = this.dbAdmin,
  ): Promise<void> {
    const relationships = RELATIONSHIP_TABLES[kind];
    await dbInstance
      .update(relationships.table)
      .set({ syncStatus: MASTER_COURSE_EXPORT_SYNC_STATUSES.FAILED })
      .where(
        and(
          eq(relationships.table.id, id),
          ne(relationships.table.syncStatus, MASTER_COURSE_EXPORT_SYNC_STATUSES.PAUSED),
        ),
      );
  }

  async markSynced(
    kind: CourseTransferKind,
    id: UUIDType,
    targetId: UUIDType,
    transaction: DatabasePg,
  ): Promise<void> {
    const values = {
      syncStatus: MASTER_COURSE_EXPORT_SYNC_STATUSES.ACTIVE,
      lastSyncedAt: sql`CURRENT_TIMESTAMP`,
    };

    await match(kind)
      .with(COURSE_TRANSFER_KINDS.COURSE, () =>
        transaction
          .update(masterCourseExports)
          .set({ ...values, targetCourseId: targetId })
          .where(eq(masterCourseExports.id, id)),
      )
      .with(COURSE_TRANSFER_KINDS.LEARNING_PATH, () =>
        transaction
          .update(learningPathExports)
          .set({ ...values, targetLearningPathId: targetId })
          .where(eq(learningPathExports.id, id)),
      )
      .exhaustive();
  }

  async findExportCandidatesPage(query: CourseTransferExportCandidatesQuery) {
    const relationships = RELATIONSHIP_TABLES[query.kind];
    return this.dbAdmin
      .select({
        id: tenants.id,
        name: tenants.name,
        host: tenants.host,
        targetId: relationships.targetId,
        syncStatus: relationships.table.syncStatus,
        lastSyncedAt: relationships.table.lastSyncedAt,
        isExported: sql<boolean>`coalesce(${this.isRelationshipExported(query.kind)}, false)`,
      })
      .from(tenants)
      .leftJoin(relationships.table, this.joinCandidateRelationship(query))
      .where(this.matchExportCandidates(query))
      .orderBy(asc(tenants.name), asc(tenants.id))
      .limit(query.perPage)
      .offset((query.page - 1) * query.perPage);
  }

  async countExportCandidates(query: CourseTransferExportCandidatesQuery) {
    const [result] = await this.dbAdmin
      .select({ count: count() })
      .from(tenants)
      .where(this.matchExportCandidates(query));

    return result?.count ?? 0;
  }

  async summarizeExportCandidates(query: CourseTransferExportCandidatesQuery) {
    const relationships = RELATIONSHIP_TABLES[query.kind];
    const [summary] = await this.dbAdmin
      .select({
        totalTenants: count(),
        exportedCount: count(relationships.table.id).as("exported_count"),
      })
      .from(tenants)
      .leftJoin(
        relationships.table,
        and(this.joinCandidateRelationship(query), this.isRelationshipExported(query.kind)),
      )
      .where(this.matchExportCandidates({ ...query, search: undefined }));

    return summary ?? { totalTenants: 0, exportedCount: 0 };
  }

  async findEligibleTargetTenantIds(sourceTenantId: UUIDType, targetTenantIds: UUIDType[]) {
    if (!targetTenantIds.length) return [];

    const eligibleTenants = await this.dbAdmin
      .select({ id: tenants.id })
      .from(tenants)
      .where(
        and(
          inArray(tenants.id, targetTenantIds),
          ne(tenants.id, sourceTenantId),
          eq(tenants.status, TENANT_STATUSES.ACTIVE),
        ),
      );

    return eligibleTenants.map(({ id }) => id);
  }

  private joinCandidateRelationship(query: CourseTransferExportCandidatesQuery) {
    const relationships = RELATIONSHIP_TABLES[query.kind];
    return and(
      eq(relationships.table.sourceTenantId, query.sourceTenantId),
      eq(relationships.sourceId, query.sourceId),
      eq(relationships.table.targetTenantId, tenants.id),
    );
  }

  private isRelationshipExported(kind: CourseTransferKind) {
    const relationships = RELATIONSHIP_TABLES[kind];
    return and(
      eq(relationships.table.syncStatus, MASTER_COURSE_EXPORT_SYNC_STATUSES.ACTIVE),
      isNotNull(relationships.targetId),
      isNotNull(relationships.table.lastSyncedAt),
    );
  }

  private matchExportCandidates(query: CourseTransferExportCandidatesQuery) {
    const searchPattern = query.search ? `%${query.search}%` : undefined;
    return and(
      ne(tenants.id, query.sourceTenantId),
      eq(tenants.status, TENANT_STATUSES.ACTIVE),
      searchPattern
        ? or(ilike(tenants.name, searchPattern), ilike(tenants.host, searchPattern))
        : undefined,
    );
  }

  private selectRelationship(kind: CourseTransferKind) {
    const relationships = RELATIONSHIP_TABLES[kind];

    return {
      kind: sql<CourseTransferKind>`${kind}::text`,
      id: relationships.table.id,
      sourceTenantId: relationships.table.sourceTenantId,
      sourceId: relationships.sourceId,
      targetTenantId: relationships.table.targetTenantId,
      targetId: relationships.targetId,
      syncStatus: relationships.table.syncStatus,
      lastSyncedAt: relationships.table.lastSyncedAt,
    };
  }
}
