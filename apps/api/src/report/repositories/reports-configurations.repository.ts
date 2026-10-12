import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, getTableColumns, or, sql } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { reportsConfigurations } from "src/storage/schema";

import {
  REPORT_CONFIGURATION_VISIBILITY,
  REPORT_FAILURE_CODE,
} from "../constants/reports.constants";

import { serializeReportQuery } from "./reports-query.persistence";
import { ReportsQueryScopeRepository } from "./reports-query.scope.repository";

import type { ReportsAccess } from "../reports-access.types";
import type {
  CreateReportConfiguration,
  UpdateReportConfiguration,
  ReportConfigurationResponse,
} from "../schemas/reports-configurations.schema";
import type { UUIDType } from "src/common";

export type ReportConfigurationRecord = typeof reportsConfigurations.$inferSelect;
export type ReportConfigurationListRecord = ReportConfigurationRecord &
  Pick<ReportConfigurationResponse, "isAvailable" | "failureCode">;

@Injectable()
export class ReportsConfigurationsRepository {
  private readonly reportsQueryScopeRepository: ReportsQueryScopeRepository;

  constructor(@Inject("DB") private readonly db: DatabasePg) {
    this.reportsQueryScopeRepository = new ReportsQueryScopeRepository(db);
  }

  findVisibleWithAvailability(
    tenantId: UUIDType,
    userId: UUIDType,
    access: ReportsAccess,
  ): Promise<ReportConfigurationListRecord[]> {
    const isAvailable = this.reportsQueryScopeRepository.buildSavedQueryAvailabilityPredicate(
      sql`${reportsConfigurations.query}`,
      access,
    );
    return this.db
      .select({
        ...getTableColumns(reportsConfigurations),
        isAvailable,
        failureCode: sql<ReportConfigurationListRecord["failureCode"]>`
          CASE WHEN ${isAvailable} THEN NULL ELSE ${REPORT_FAILURE_CODE.INACCESSIBLE_REFERENCE} END
        `,
      })
      .from(reportsConfigurations)
      .where(
        and(
          eq(reportsConfigurations.tenantId, tenantId),
          or(
            eq(reportsConfigurations.ownerId, userId),
            eq(reportsConfigurations.visibility, REPORT_CONFIGURATION_VISIBILITY.SHARED),
          ),
        ),
      )
      .orderBy(desc(reportsConfigurations.updatedAt));
  }

  async findById(tenantId: UUIDType, id: UUIDType): Promise<ReportConfigurationRecord | undefined> {
    const [configuration] = await this.db
      .select()
      .from(reportsConfigurations)
      .where(and(eq(reportsConfigurations.id, id), eq(reportsConfigurations.tenantId, tenantId)))
      .limit(1);
    return configuration;
  }

  async create(
    tenantId: UUIDType,
    ownerId: UUIDType,
    input: CreateReportConfiguration,
  ): Promise<ReportConfigurationRecord> {
    const [configuration] = await this.db
      .insert(reportsConfigurations)
      .values({
        tenantId,
        ownerId,
        name: input.name.trim(),
        visibility: input.visibility,
        query: serializeReportQuery(input.query),
      })
      .returning();
    return configuration;
  }

  async update(
    tenantId: UUIDType,
    id: UUIDType,
    input: UpdateReportConfiguration,
  ): Promise<ReportConfigurationRecord | undefined> {
    const [configuration] = await this.db
      .update(reportsConfigurations)
      .set({
        ...(input.name === undefined ? {} : { name: input.name.trim() }),
        ...(input.visibility === undefined ? {} : { visibility: input.visibility }),
        ...(input.query === undefined ? {} : { query: serializeReportQuery(input.query) }),
      })
      .where(and(eq(reportsConfigurations.id, id), eq(reportsConfigurations.tenantId, tenantId)))
      .returning();

    return configuration;
  }

  async delete(tenantId: UUIDType, id: UUIDType): Promise<void> {
    await this.db
      .delete(reportsConfigurations)
      .where(and(eq(reportsConfigurations.id, id), eq(reportsConfigurations.tenantId, tenantId)));
  }
}
