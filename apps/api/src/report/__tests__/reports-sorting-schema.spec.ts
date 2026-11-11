import { REPORT_SORT_DIRECTIONS, REPORT_SORT_FIELDS } from "@repo/shared";
import { Value } from "@sinclair/typebox/value";

import { reportsQuerySchema } from "../schemas/reports.schema";

const reportsQuery = {
  view: "organisation",
  timezone: "UTC",
  groupIds: [],
  language: "en",
  page: 1,
  pageSize: 25,
};

describe("reports query sorting schema", () => {
  const supportedSorts = Object.values(REPORT_SORT_FIELDS).flatMap((sortBy) =>
    Object.values(REPORT_SORT_DIRECTIONS).map((sortDirection) => ({ sortBy, sortDirection })),
  );

  it("accepts a query without sorting", () => {
    expect(Value.Check(reportsQuerySchema, reportsQuery)).toBe(true);
  });

  it.each(supportedSorts)("accepts sorting by $sortBy $sortDirection", (sort) => {
    expect(Value.Check(reportsQuerySchema, { ...reportsQuery, ...sort })).toBe(true);
  });

  it.each([
    { name: "an unknown sort column", sort: { sortBy: "learner; DROP TABLE users" } },
    { name: "an unknown sort direction", sort: { sortDirection: "DESC NULLS FIRST" } },
  ])("rejects $name", ({ sort }) => {
    expect(Value.Check(reportsQuerySchema, { ...reportsQuery, ...sort })).toBe(false);
  });
});
