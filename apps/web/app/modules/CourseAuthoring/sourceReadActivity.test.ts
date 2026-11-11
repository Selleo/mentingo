import { describe, expect, it } from "vitest";

import { compactSourceReadActivity } from "./sourceReadActivity";

import type { AuthoringTurnPart } from "./courseAuthoring.types";

/** Represent independently identified tool calls retained by event replay. */
const read = (
  id: string,
  status: NonNullable<AuthoringTurnPart["tool"]>["status"],
  taskId = "plan",
): { taskId: string; tool: NonNullable<AuthoringTurnPart["tool"]> } => ({
  taskId,
  tool: {
    toolCallId: id,
    toolName: "read_selected_sources",
    display: "Selected file evidence loaded",
    status,
    result: null,
  },
});

describe("compactSourceReadActivity", () => {
  it("shows twenty completed source pages as one current activity", () => {
    const entries = Array.from({ length: 20 }, (_, index) => read(`read-${index}`, "completed"));
    expect(compactSourceReadActivity(entries, (entry) => entry)).toEqual([entries[19]]);
    expect(entries).toHaveLength(20);
  });

  it("retains an active read even when another parallel page has already finished", () => {
    const active = read("active", "started");
    expect(
      compactSourceReadActivity([active, read("done", "completed")], (entry) => entry),
    ).toEqual([active]);
  });

  it("keeps failures, stopped reads, other tools and independent tasks visible", () => {
    const failed = read("failed", "failed");
    const stopped = read("stopped", "stopped");
    const otherTask = read("other-plan", "completed", "other");
    const search = {
      ...read("web", "completed"),
      tool: { ...read("web", "completed").tool, toolName: "web_search" },
    };
    const entries = [
      read("old", "completed"),
      failed,
      stopped,
      otherTask,
      search,
      read("new", "completed"),
    ];
    expect(compactSourceReadActivity(entries, (entry) => entry)).toEqual(entries.slice(1));
  });

  it("preserves text order and skips non-tool timeline parts", () => {
    const text = { text: "Here is the plan." };
    const entries = [read("old", "completed"), text, read("new", "completed")];
    expect(
      compactSourceReadActivity(entries, (entry) => ("tool" in entry ? entry : undefined)),
    ).toEqual(entries.slice(1));
  });
});
