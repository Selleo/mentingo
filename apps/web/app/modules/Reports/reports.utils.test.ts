import { describe, expect, it } from "vitest";

import { formatReportDate } from "./reports.utils";

describe("formatReportDate", () => {
  it("uses the report timezone for timestamps near midnight", () => {
    const timestamp = "2026-03-28T23:30:00.000Z";
    expect(formatReportDate(timestamp, "en-US", "UTC")).toBe("Mar 28, 2026");
    expect(formatReportDate(timestamp, "en-US", "Europe/Warsaw")).toBe("Mar 29, 2026");
  });

  it("applies daylight saving time in the report timezone", () => {
    expect(formatReportDate("2026-03-29T22:30:00.000Z", "en-US", "Europe/Warsaw")).toBe(
      "Mar 30, 2026",
    );
  });

  it("preserves the selected language and empty dates", () => {
    expect(formatReportDate("2026-03-28T23:30:00.000Z", "pl", "Europe/Warsaw")).toBe("29 mar 2026");
    expect(formatReportDate(null, "en-US", "UTC")).toBe("—");
  });
});
