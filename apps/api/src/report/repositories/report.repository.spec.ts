import { sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";

import { groups } from "src/storage/schema";

import { ReportRepository } from "./report.repository";

import type { DatabasePg } from "src/common";
import type { LocalizationService } from "src/localization/localization.service";

describe("ReportRepository", () => {
  it("aggregates group names through the localization service", async () => {
    const query = {
      from: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockResolvedValue([]),
    };
    const db = {
      select: jest.fn().mockReturnValue(query),
    } as unknown as DatabasePg;
    const localizationService = {
      getLocalizedSqlField: jest.fn((field) =>
        field === groups.name
          ? sql<string>`localized_group_name`
          : sql<string>`localized_course_title`,
      ),
    } as unknown as LocalizationService;

    const repository = new ReportRepository(db, localizationService);

    await repository.getAllStudentCourseData("pl", {
      permissions: [],
      userId: "user-id",
    } as never);

    const selectFields = (db.select as jest.Mock).mock.calls[0][0];
    const renderedGroupNameSql = new PgDialect().sqlToQuery(selectFields.groupName).sql;

    expect(localizationService.getLocalizedSqlField).toHaveBeenCalledWith(
      groups.name,
      "pl",
      groups,
    );
    expect(renderedGroupNameSql).toMatch(/STRING_AGG\s*\(\s*DISTINCT\s+NULLIF/i);
    expect(renderedGroupNameSql).toContain("localized_group_name");
    expect(renderedGroupNameSql).not.toContain("STRING_AGG(DISTINCT g.name");
  });
});
