import { createHash } from "node:crypto";

import { Injectable } from "@nestjs/common";

import { assertCanReadReports, reportsAccessFingerprint } from "./reports-access";
import { ReportsQueryRepository } from "./repositories/reports-query.repository";
import { validateReportsQuerySemantics } from "./schemas/reports.schema";

import type { ReportsAccessScope } from "./reports-access.types";
import type {
  ReportDefinition,
  ReportOptions,
  ReportsQuery,
  ReportsResult,
} from "./schemas/reports.schema";
import type { SupportedLanguages } from "@repo/shared";
import type { CurrentUserType } from "src/common/types/current-user.type";

@Injectable()
export class ReportsQueryService {
  constructor(private readonly reportsQueryRepository: ReportsQueryRepository) {}

  async getReport(query: ReportsQuery, actor: CurrentUserType): Promise<ReportsResult> {
    const scope = await this.resolveValidatedScope(query, actor);
    return this.reportsQueryRepository.findReport(query, scope, { allRows: false });
  }

  /** Used by export workers: all rows are still selected and filtered inside PostgreSQL. */
  async getAllReportRows(query: ReportsQuery, actor: CurrentUserType): Promise<ReportsResult> {
    const scope = await this.resolveValidatedScope(query, actor);
    return this.reportsQueryRepository.findReport(query, scope, { allRows: true });
  }

  async validateReportAccess(query: ReportDefinition, actor: CurrentUserType): Promise<void> {
    await this.resolveValidatedScope(query, actor);
  }

  async getReportOptions(
    actor: CurrentUserType,
    language: SupportedLanguages,
    search?: string,
  ): Promise<ReportOptions> {
    const scope = await this.resolveAccessScope(actor);
    return this.reportsQueryRepository.findOptions(scope, language, search);
  }

  /** Changes whenever the viewer's permissions, groups or the learners behind them change. */
  async getReportAccessFingerprint(
    query: ReportDefinition,
    actor: CurrentUserType,
  ): Promise<string> {
    const scope = await this.resolveAccessScope(actor);
    const liveScopeHashes = await this.reportsQueryRepository.findLiveScopeHashes(scope.access);

    const fingerprintInput = JSON.stringify({
      access: reportsAccessFingerprint(scope.access, scope.managedGroupIds, liveScopeHashes),
      authorizedGroupIds: scope.authorizedGroupIds,
      view: query.view,
      groups: [...query.groupIds].sort(),
      subjectId: query.subjectId ?? null,
    });

    return createHash("sha256").update(fingerprintInput).digest("hex");
  }

  private async resolveValidatedScope(
    query: ReportDefinition,
    actor: CurrentUserType,
  ): Promise<ReportsAccessScope> {
    validateReportsQuerySemantics(query);
    const scope = await this.resolveAccessScope(actor);
    await this.reportsQueryRepository.validateScopeReferences(query, scope);

    return scope;
  }

  private async resolveAccessScope(actor: CurrentUserType): Promise<ReportsAccessScope> {
    const access = assertCanReadReports(actor);
    return this.reportsQueryRepository.findAccessScope(actor, access);
  }
}
