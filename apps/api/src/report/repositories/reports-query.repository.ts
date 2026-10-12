import { Inject, Injectable } from "@nestjs/common";

import { DatabasePg } from "src/common";
import { LocalizationService } from "src/localization/localization.service";

import { executeReportQuery } from "./reports-query.executor";
import { ReportsQueryOptionsRepository } from "./reports-query.options.repository";
import { ReportsQueryScopeRepository } from "./reports-query.scope.repository";

import type { ReportData } from "./reports-query.types";
import type {
  ReportsAccess,
  ReportsAccessScope,
  ReportsScopeHashes,
} from "../reports-access.types";
import type { ReportDefinition, ReportOptions, ReportsQuery } from "../schemas/reports.schema";
import type { SupportedLanguages } from "@repo/shared";
import type { CurrentUserType } from "src/common/types/current-user.type";

@Injectable()
export class ReportsQueryRepository {
  private readonly reportsQueryScopeRepository: ReportsQueryScopeRepository;
  private readonly reportsQueryOptionsRepository: ReportsQueryOptionsRepository;

  constructor(
    @Inject("DB") private readonly db: DatabasePg,
    private readonly localizationService: LocalizationService,
  ) {
    this.reportsQueryScopeRepository = new ReportsQueryScopeRepository(db);
    this.reportsQueryOptionsRepository = new ReportsQueryOptionsRepository(db, localizationService);
  }

  async findAccessScope(
    actor: CurrentUserType,
    access: ReportsAccess,
  ): Promise<ReportsAccessScope> {
    return this.reportsQueryScopeRepository.findAccessScope(actor, access);
  }

  async findLiveScopeHashes(access: ReportsAccess): Promise<Required<ReportsScopeHashes>> {
    return this.reportsQueryScopeRepository.findLiveScopeHashes(access);
  }

  async validateScopeReferences(query: ReportDefinition, scope: ReportsAccessScope): Promise<void> {
    return this.reportsQueryScopeRepository.validateScopeReferences(query, scope);
  }

  /** Runs the whole report in one read-only snapshot so metrics, rows and totals agree. */
  async findReport(
    query: ReportsQuery,
    scope: ReportsAccessScope,
    { allRows }: { allRows: boolean },
  ): Promise<ReportData> {
    return this.db.transaction(
      (transaction) =>
        executeReportQuery(transaction, this.localizationService, { ...scope, query, allRows }),
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  }

  async findOptions(
    scope: ReportsAccessScope,
    language: SupportedLanguages,
    search?: string,
  ): Promise<ReportOptions> {
    return this.reportsQueryOptionsRepository.findOptions(scope, language, search);
  }
}
