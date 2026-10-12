import { and, asc, eq, sql } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { LocalizationService } from "src/localization/localization.service";
import { courses, groups, learningPaths, users } from "src/storage/schema";

import { REPORT_LIMITS } from "../constants/reports.constants";

import {
  courseIsVisible,
  groupIsVisible,
  isReportableLearner,
  learnerIsVisible,
  pathIsVisible,
} from "./reports-query.visibility";

import type { ReportOption } from "./reports-query.types";
import type { ReportsAccessScope } from "../reports-access.types";
import type { ReportOptions } from "../schemas/reports.schema";
import type { SupportedLanguages } from "@repo/shared";
import type { SQL } from "drizzle-orm";

/** Selector options for the report builder, limited to what the viewer may report on. */
export class ReportsQueryOptionsRepository {
  constructor(
    private readonly db: DatabasePg,
    private readonly localizationService: LocalizationService,
  ) {}

  async findOptions(
    scope: ReportsAccessScope,
    language: SupportedLanguages,
    search?: string,
  ): Promise<ReportOptions> {
    const searchPattern = toSearchPattern(search);

    return {
      groups: await this.findGroupOptions(scope, language, searchPattern),
      learners: await this.findLearnerOptions(scope, searchPattern),
      courses: await this.findCourseOptions(scope, language, searchPattern),
      paths: await this.findPathOptions(scope, language, searchPattern),
      canManageShared: scope.access.canManageShared,
    };
  }

  private findGroupOptions(
    scope: ReportsAccessScope,
    language: SupportedLanguages,
    searchPattern: string | null,
  ): Promise<ReportOption[]> {
    const name = this.localizationService.getLocalizedSqlField(groups.name, language, groups);

    return this.db
      .select({ id: groups.id, label: name })
      .from(groups)
      .where(and(groupIsVisible(scope), matchesSearch(name, searchPattern)))
      .orderBy(name)
      .limit(REPORT_LIMITS.SELECTOR_OPTIONS);
  }

  private findLearnerOptions(
    scope: ReportsAccessScope,
    searchPattern: string | null,
  ): Promise<ReportOption[]> {
    const fullName = sql<string>`concat_ws(' ', ${users.firstName}, ${users.lastName})`;
    const searchableText = sql<string>`concat_ws(' ', ${users.firstName}, ${users.lastName}, ${users.email})`;

    return this.db
      .select({ id: users.id, label: sql<string>`${fullName} || ' · ' || ${users.email}` })
      .from(users)
      .where(
        and(
          eq(users.tenantId, scope.access.tenantId),
          sql`${users.deletedAt} IS NULL`,
          isReportableLearner(this.db, scope),
          learnerIsVisible(this.db, scope),
          matchesSearch(searchableText, searchPattern),
        ),
      )
      .orderBy(asc(users.firstName), asc(users.lastName), asc(users.email))
      .limit(REPORT_LIMITS.SELECTOR_OPTIONS);
  }

  private findCourseOptions(
    scope: ReportsAccessScope,
    language: SupportedLanguages,
    searchPattern: string | null,
  ): Promise<ReportOption[]> {
    const title = this.localizationService.getLocalizedSqlField(courses.title, language, courses);

    return this.db
      .select({ id: courses.id, label: title })
      .from(courses)
      .where(and(courseIsVisible(this.db, scope), matchesSearch(title, searchPattern)))
      .orderBy(title)
      .limit(REPORT_LIMITS.SELECTOR_OPTIONS);
  }

  private findPathOptions(
    scope: ReportsAccessScope,
    language: SupportedLanguages,
    searchPattern: string | null,
  ): Promise<ReportOption[]> {
    const title = this.localizationService.getLocalizedSqlField(
      learningPaths.title,
      language,
      learningPaths,
    );

    return this.db
      .select({ id: learningPaths.id, label: title })
      .from(learningPaths)
      .where(and(pathIsVisible(this.db, scope), matchesSearch(title, searchPattern)))
      .orderBy(title)
      .limit(REPORT_LIMITS.SELECTOR_OPTIONS);
  }
}

function toSearchPattern(search: string | undefined): string | null {
  const escaped = search?.replace(/[\\%_]/g, "\\$&");
  return escaped ? `%${escaped}%` : null;
}

function matchesSearch(text: SQL, searchPattern: string | null): SQL | undefined {
  return searchPattern ? sql`${text} ILIKE ${searchPattern}` : undefined;
}
