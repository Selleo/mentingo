import { Inject, Injectable } from "@nestjs/common";
import { AUDIT_TYPES, TENANT_STATUSES } from "@repo/shared";
import { and, asc, desc, eq, lte, sql } from "drizzle-orm";

import { DatabasePg, type UUIDType } from "src/common";
import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import { auditSubmissions, tenants } from "src/storage/schema";

import type {
  AuditBenchmarkSubmission,
  AuditSubmissionResult,
  CreateAuditSubmissionRecord,
} from "./audit.types";
import type { AuditType } from "@repo/shared";

const submissionSelection = {
  id: auditSubmissions.id,
  type: auditSubmissions.type,
  definitionVersion: auditSubmissions.definitionVersion,
  score: auditSubmissions.score,
  competencyScores: auditSubmissions.competencyScores,
  completedAt: auditSubmissions.completedAt,
};

@Injectable()
export class AuditRepository {
  constructor(
    @Inject(DB) private readonly db: DatabasePg,
    @Inject(DB_ADMIN) private readonly dbAdmin: DatabasePg,
  ) {}

  async create(record: CreateAuditSubmissionRecord): Promise<AuditSubmissionResult> {
    const [submission] = await this.db
      .insert(auditSubmissions)
      .values(record)
      .returning(submissionSelection);

    return submission;
  }

  async findLatestIndividual(userId: UUIDType): Promise<AuditSubmissionResult | null> {
    const [submission] = await this.db
      .select(submissionSelection)
      .from(auditSubmissions)
      .where(
        and(
          eq(auditSubmissions.type, AUDIT_TYPES.INDIVIDUAL),
          eq(auditSubmissions.submittedById, userId),
        ),
      )
      .orderBy(desc(auditSubmissions.completedAt), desc(auditSubmissions.id))
      .limit(1);

    return submission ?? null;
  }

  async findLatestSchool(): Promise<AuditSubmissionResult | null> {
    const [submission] = await this.db
      .select(submissionSelection)
      .from(auditSubmissions)
      .where(eq(auditSubmissions.type, AUDIT_TYPES.SCHOOL))
      .orderBy(desc(auditSubmissions.completedAt), desc(auditSubmissions.id))
      .limit(1);

    return submission ?? null;
  }

  async findHistory(type: AuditType, userId?: UUIDType): Promise<AuditSubmissionResult[]> {
    return this.db
      .select(submissionSelection)
      .from(auditSubmissions)
      .where(
        and(
          eq(auditSubmissions.type, type),
          ...(userId ? [eq(auditSubmissions.submittedById, userId)] : []),
        ),
      )
      .orderBy(desc(auditSubmissions.completedAt), desc(auditSubmissions.id))
      .limit(50);
  }

  async findById(
    type: AuditType,
    id: UUIDType,
    userId?: UUIDType,
  ): Promise<AuditSubmissionResult | null> {
    const [submission] = await this.db
      .select(submissionSelection)
      .from(auditSubmissions)
      .where(
        and(
          eq(auditSubmissions.id, id),
          eq(auditSubmissions.type, type),
          ...(userId ? [eq(auditSubmissions.submittedById, userId)] : []),
        ),
      )
      .limit(1);

    return submission ?? null;
  }

  async findBenchmarkSubmissions(): Promise<AuditBenchmarkSubmission[]> {
    const submissionOrder = sql<number>`row_number() over (
      partition by ${auditSubmissions.tenantId}
      order by ${auditSubmissions.completedAt} desc, ${auditSubmissions.id} desc
    )`.as("submission_order");
    const rankedSubmissions = this.dbAdmin
      .select({
        tenantId: auditSubmissions.tenantId,
        score: auditSubmissions.score,
        submissionOrder,
      })
      .from(auditSubmissions)
      .where(eq(auditSubmissions.type, AUDIT_TYPES.SCHOOL))
      .as("ranked_audit_submissions");

    return this.dbAdmin
      .select({
        tenantId: tenants.id,
        name: tenants.name,
        score: rankedSubmissions.score,
        submissionOrder: rankedSubmissions.submissionOrder,
      })
      .from(rankedSubmissions)
      .innerJoin(tenants, eq(tenants.id, rankedSubmissions.tenantId))
      .where(
        and(
          lte(rankedSubmissions.submissionOrder, 2),
          eq(tenants.status, TENANT_STATUSES.ACTIVE),
          eq(tenants.isManaging, false),
        ),
      )
      .orderBy(asc(tenants.name), rankedSubmissions.submissionOrder);
  }
}
