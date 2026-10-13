import { Inject, Injectable } from "@nestjs/common";
import { and, asc, eq, inArray, isNotNull, isNull, lt, lte, or } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { DB } from "src/storage/db/db.providers";
import { reportsExports, users } from "src/storage/schema";

import { REPORT_EXPORT_STATUS, REPORT_FAILURE_CODE } from "../constants/reports.constants";

import { serializeReportQuery } from "./reports-query.persistence";

import type { UUIDType } from "src/common";

export type ReportExportRecord = typeof reportsExports.$inferSelect;
export type NewReportExportRecord = typeof reportsExports.$inferInsert;
export type ReportExportActorIdentity = Pick<
  typeof users.$inferSelect,
  "id" | "email" | "tenantId"
>;

export interface ReportExportCompletion {
  artifactKey: string;
  expiresAt: string;
}

@Injectable()
export class ReportsExportsRepository {
  constructor(@Inject(DB) private readonly db: DatabasePg) {}

  async createPending(input: NewReportExportRecord): Promise<ReportExportRecord> {
    const [record] = await this.db
      .insert(reportsExports)
      .values({ ...input, query: serializeReportQuery(input.query) })
      .returning();

    return record;
  }

  async findForActor(
    tenantId: UUIDType,
    actorId: UUIDType,
    exportId: UUIDType,
  ): Promise<ReportExportRecord | undefined> {
    const [record] = await this.db
      .select()
      .from(reportsExports)
      .where(
        and(
          eq(reportsExports.id, exportId),
          eq(reportsExports.tenantId, tenantId),
          eq(reportsExports.actorId, actorId),
        ),
      )
      .limit(1);

    return record;
  }

  async findForJob(
    tenantId: UUIDType,
    actorId: UUIDType,
    exportId: UUIDType,
  ): Promise<ReportExportRecord | undefined> {
    return this.findForActor(tenantId, actorId, exportId);
  }

  async findActorIdentity(
    tenantId: UUIDType,
    actorId: UUIDType,
  ): Promise<ReportExportActorIdentity | undefined> {
    const [identity] = await this.db
      .select({ id: users.id, email: users.email, tenantId: users.tenantId })
      .from(users)
      .where(and(eq(users.id, actorId), eq(users.tenantId, tenantId), isNull(users.deletedAt)))
      .limit(1);

    return identity;
  }

  async markQueueUnavailable(tenantId: UUIDType, exportId: UUIDType): Promise<void> {
    await this.db
      .update(reportsExports)
      .set({
        status: REPORT_EXPORT_STATUS.FAILED,
        failureCode: REPORT_FAILURE_CODE.QUEUE_UNAVAILABLE,
      })
      .where(
        and(
          eq(reportsExports.id, exportId),
          eq(reportsExports.tenantId, tenantId),
          eq(reportsExports.status, REPORT_EXPORT_STATUS.PENDING),
        ),
      );
  }

  async claim(
    tenantId: UUIDType,
    actorId: UUIDType,
    exportId: UUIDType,
    token: string,
    staleBefore: string,
  ): Promise<boolean> {
    const claimed = await this.db
      .update(reportsExports)
      .set({
        status: REPORT_EXPORT_STATUS.PROCESSING,
        processingToken: token,
        failureCode: null,
        updatedAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(reportsExports.id, exportId),
          eq(reportsExports.tenantId, tenantId),
          eq(reportsExports.actorId, actorId),
          or(
            inArray(reportsExports.status, [
              REPORT_EXPORT_STATUS.PENDING,
              REPORT_EXPORT_STATUS.FAILED,
            ]),
            and(
              eq(reportsExports.status, REPORT_EXPORT_STATUS.PROCESSING),
              lt(reportsExports.updatedAt, staleBefore),
            ),
          ),
        ),
      )
      .returning({ id: reportsExports.id });
    return claimed.length > 0;
  }

  async renewClaim(tenantId: UUIDType, exportId: UUIDType, token: string): Promise<void> {
    await this.db
      .update(reportsExports)
      .set({ updatedAt: new Date().toISOString() })
      .where(
        and(
          eq(reportsExports.id, exportId),
          eq(reportsExports.tenantId, tenantId),
          eq(reportsExports.status, REPORT_EXPORT_STATUS.PROCESSING),
          eq(reportsExports.processingToken, token),
        ),
      );
  }

  async completeClaim(
    tenantId: UUIDType,
    exportId: UUIDType,
    token: string,
    completion: ReportExportCompletion,
  ): Promise<boolean> {
    const completed = await this.db
      .update(reportsExports)
      .set({
        status: REPORT_EXPORT_STATUS.COMPLETED,
        artifactKey: completion.artifactKey,
        processingToken: null,
        expiresAt: completion.expiresAt,
        failureCode: null,
      })
      .where(
        and(
          eq(reportsExports.id, exportId),
          eq(reportsExports.tenantId, tenantId),
          eq(reportsExports.status, REPORT_EXPORT_STATUS.PROCESSING),
          eq(reportsExports.processingToken, token),
        ),
      )
      .returning({ id: reportsExports.id });
    return completed.length > 0;
  }

  async failClaim(
    tenantId: UUIDType,
    exportId: UUIDType,
    token: string,
    failureCode: string,
  ): Promise<void> {
    await this.db
      .update(reportsExports)
      .set({
        status: REPORT_EXPORT_STATUS.FAILED,
        failureCode,
        artifactKey: null,
        processingToken: null,
      })
      .where(
        and(
          eq(reportsExports.id, exportId),
          eq(reportsExports.tenantId, tenantId),
          eq(reportsExports.status, REPORT_EXPORT_STATUS.PROCESSING),
          eq(reportsExports.processingToken, token),
        ),
      );
  }

  async clearArtifact(tenantId: UUIDType, exportId: UUIDType, artifactKey: string): Promise<void> {
    await this.db
      .update(reportsExports)
      .set({ artifactKey: null })
      .where(
        and(
          eq(reportsExports.id, exportId),
          eq(reportsExports.tenantId, tenantId),
          eq(reportsExports.artifactKey, artifactKey),
        ),
      );
  }

  async findExpiredArtifacts(
    tenantId: UUIDType,
    now: string,
    limit: number,
  ): Promise<Array<Pick<ReportExportRecord, "id" | "artifactKey">>> {
    return this.db
      .select({ id: reportsExports.id, artifactKey: reportsExports.artifactKey })
      .from(reportsExports)
      .where(
        and(
          eq(reportsExports.tenantId, tenantId),
          eq(reportsExports.status, REPORT_EXPORT_STATUS.COMPLETED),
          lte(reportsExports.expiresAt, now),
          isNotNull(reportsExports.artifactKey),
        ),
      )
      .orderBy(asc(reportsExports.expiresAt))
      .limit(limit);
  }
}
