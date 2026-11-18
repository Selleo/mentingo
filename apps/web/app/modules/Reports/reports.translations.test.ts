import { describe, expect, it } from "vitest";

const locales = import.meta.glob("../../locales/*/translation.json", {
  eager: true,
  import: "default",
});

describe("course activity translations", () => {
  it.each(Object.entries(locales))(
    "defines the course activity metrics and limitations in %s",
    (_path, locale) => {
      const activity = (locale as { reports: { activity?: Record<string, string> } }).reports
        .activity;
      for (const key of [
        "title",
        "popular",
        "inactive",
        "learners",
        "days",
        "never",
        "empty",
        "from",
        "to",
        "apply",
        "period",
        "definition",
        "limitation",
      ]) {
        expect(activity?.[key], key).toBeTruthy();
      }
      expect(activity?.period).toContain("{{from}}");
      expect(activity?.period).toContain("{{to}}");
    },
  );
});

describe("report sorting translations", () => {
  it.each(Object.entries(locales))("provides sort action labels in %s", (_path, locale) => {
    const table = (locale as { reports: { table: Record<string, string> } }).reports.table;
    expect(table.sortAscending).toBeTruthy();
    expect(table.sortDescending).toBeTruthy();
    expect(table.sortAscending).not.toEqual(table.sortDescending);
  });
});
