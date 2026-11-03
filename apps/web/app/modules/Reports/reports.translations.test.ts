import { describe, expect, it } from "vitest";

const locales = import.meta.glob("../../locales/*/translation.json", {
  eager: true,
  import: "default",
});

describe("report sorting translations", () => {
  it.each(Object.entries(locales))("provides sort action labels in %s", (_path, locale) => {
    const table = (locale as { reports: { table: Record<string, string> } }).reports.table;
    expect(table.sortAscending).toBeTruthy();
    expect(table.sortDescending).toBeTruthy();
    expect(table.sortAscending).not.toEqual(table.sortDescending);
  });
});
