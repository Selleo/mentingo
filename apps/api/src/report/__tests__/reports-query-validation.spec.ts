import { REPORT_ERRORS } from "../constants/reports.errors";
import { REPORT_VIEWS, validateReportsQuerySemantics } from "../schemas/reports.schema";

import type { ReportsQuery } from "../schemas/reports.schema";

const baseQuery = (overrides: Partial<ReportsQuery> = {}): ReportsQuery => ({
  view: REPORT_VIEWS.ORGANISATION,
  language: "en",
  timezone: "Europe/Warsaw",
  groupIds: [],
  page: 1,
  pageSize: 25,
  ...overrides,
});

describe("reports query semantic validation", () => {
  it("validates the optional inclusive course activity period", () => {
    for (const activityPeriod of [
      { from: "2026-02-30", to: "2026-03-01" },
      { from: "2026-03-02", to: "2026-03-01" },
      { from: "bad", to: "2026-03-01" },
    ]) {
      expect(() => validateReportsQuerySemantics(baseQuery({ activityPeriod }))).toThrow();
    }
    expect(() =>
      validateReportsQuerySemantics(
        baseQuery({
          activityPeriod: { from: "2026-03-01", to: "2026-03-01" },
        }),
      ),
    ).not.toThrow();
  });
  it("requires a subject for specific views and rejects invalid timezones", () => {
    expect(() => validateReportsQuerySemantics(baseQuery({ view: REPORT_VIEWS.COURSE }))).toThrow(
      REPORT_ERRORS.SUBJECT_REQUIRED,
    );
    expect(() => validateReportsQuerySemantics(baseQuery({ timezone: "Mars/Olympus" }))).toThrow(
      REPORT_ERRORS.INVALID_TIMEZONE,
    );
  });

  it("requires two ordered range values and validates their numeric range numerically", () => {
    expect(() =>
      validateReportsQuerySemantics(
        baseQuery({
          filter: {
            match: "all",
            rules: [{ field: "progress", operator: "between", value: [20] }],
          },
        }),
      ),
    ).toThrow(REPORT_ERRORS.INVALID_RANGE);
    expect(() =>
      validateReportsQuerySemantics(
        baseQuery({
          filter: {
            match: "all",
            rules: [{ field: "progress", operator: "between", value: [9, 10] }],
          },
        }),
      ),
    ).not.toThrow();
    expect(() =>
      validateReportsQuerySemantics(
        baseQuery({
          filter: {
            match: "all",
            rules: [{ field: "progress", operator: "between", value: [20, 9] }],
          },
        }),
      ),
    ).toThrow(REPORT_ERRORS.REVERSED_RANGE);
  });

  it("checks field-specific values and caps conditions across nested groups", () => {
    expect(() =>
      validateReportsQuerySemantics(
        baseQuery({
          filter: { match: "all", rules: [{ field: "status", operator: "eq", value: "unknown" }] },
        }),
      ),
    ).toThrow(REPORT_ERRORS.INVALID_STATUS);
    const rules = Array.from({ length: 16 }, () => ({
      match: "all" as const,
      rules: Array.from({ length: 2 }, () => ({
        field: "attempts" as const,
        operator: "gte" as const,
        value: 1,
      })),
    }));
    expect(() =>
      validateReportsQuerySemantics(
        baseQuery({
          filter: { match: "all", rules },
        }),
      ),
    ).toThrow(REPORT_ERRORS.TOO_MANY_CONDITIONS);
  });
});
