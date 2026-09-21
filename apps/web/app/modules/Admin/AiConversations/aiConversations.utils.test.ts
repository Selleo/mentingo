import { describe, expect, it } from "vitest";

import {
  dateBoundary,
  readConversationFilters,
  updateConversationFilters,
} from "./aiConversations.utils";

describe("conversation URL state", () => {
  it("ignores removed owner filters in legacy links", () => {
    const params = new URLSearchParams("userId=user-1&ownerName=Alex&type=practice");
    expect(readConversationFilters(params, "en")).not.toHaveProperty("userId");
    expect(updateConversationFilters(params, "page", "2")).toBe(
      "/admin/ai-conversations?type=practice&page=2",
    );
  });
  it("defaults malformed pagination and enum filters safely", () => {
    expect(
      readConversationFilters(
        new URLSearchParams("page=-1&perPage=999&type=course-chat&status=deleted"),
        "pl",
      ),
    ).toMatchObject({ page: 1, perPage: 20, type: undefined, status: undefined, language: "pl" });
  });

  it("preserves list state but clears selection and pagination on filter changes", () => {
    const result = updateConversationFilters(
      new URLSearchParams("page=3&perPage=50&userId=user-1"),
      "status",
      "archived",
    );
    expect(result).toBe("/admin/ai-conversations?perPage=50&status=archived");
  });

  it("keeps filters when changing pages and removes cleared filters", () => {
    expect(updateConversationFilters(new URLSearchParams("type=practice"), "page", "2")).toBe(
      "/admin/ai-conversations?type=practice&page=2",
    );
    expect(updateConversationFilters(new URLSearchParams("type=practice&page=2"), "type", "")).toBe(
      "/admin/ai-conversations?",
    );
  });

  it("includes selected end day using exclusive next local midnight", () => {
    const start = new Date(dateBoundary("2026-09-10")!);
    const end = new Date(dateBoundary("2026-09-10", true)!);
    expect([start.getHours(), start.getMinutes(), start.getSeconds()]).toEqual([0, 0, 0]);
    expect([end.getDate(), end.getHours(), end.getMinutes(), end.getSeconds()]).toEqual([
      11, 0, 0, 0,
    ]);
  });

  it("ignores invalid or impossible dates", () => {
    expect(dateBoundary("not-a-date")).toBeUndefined();
    expect(dateBoundary("2026-02-31")).toBeUndefined();
    expect(dateBoundary(null)).toBeUndefined();
  });
});
