import { beforeEach, describe, expect, it } from "vitest";

import { saveEntryToNavigationHistory } from "~/utils/saveEntryToNavigationHistory";

import { useNavigationHistoryStore } from "./navigationHistory";

describe("navigation history", () => {
  beforeEach(() => {
    sessionStorage.clear();
    useNavigationHistoryStore.getState().clearHistory();
  });

  it("persists the last unauthorized route through the Zustand action", () => {
    saveEntryToNavigationHistory(new Request("https://app.example.com/admin/courses?tab=all"));

    expect(useNavigationHistoryStore.getState().navigationHistory).toEqual([
      expect.objectContaining({ pathname: "/admin/courses?tab=all" }),
    ]);
    expect(JSON.parse(sessionStorage.getItem("navigation-history") ?? "{}")).toMatchObject({
      state: {
        navigationHistory: [expect.objectContaining({ pathname: "/admin/courses?tab=all" })],
      },
    });
  });

  it("clears the persisted route after post-auth recovery", () => {
    saveEntryToNavigationHistory(new Request("https://app.example.com/calendar"));

    useNavigationHistoryStore.getState().clearHistory();

    expect(useNavigationHistoryStore.getState().navigationHistory).toEqual([]);
    expect(JSON.parse(sessionStorage.getItem("navigation-history") ?? "{}")).toMatchObject({
      state: { navigationHistory: [] },
    });
  });
});
