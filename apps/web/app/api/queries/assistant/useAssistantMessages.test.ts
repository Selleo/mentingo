import { useInfiniteQuery } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useAssistantMessages } from "./useAssistantMessages";

vi.mock("@tanstack/react-query", () => ({ useInfiniteQuery: vi.fn() }));

const interval = (runStatus: string, messageStatus: string) => {
  renderHook(() => useAssistantMessages("thread"));
  const options = vi.mocked(useInfiniteQuery).mock.lastCall?.[0];
  const poll = options?.refetchInterval;
  if (typeof poll !== "function") throw new Error("Expected the polling policy");
  return poll({
    state: {
      data: {
        pages: [
          {
            latestRun: { status: runStatus },
            items: [{ role: "assistant", status: messageStatus }],
          },
        ],
      },
    },
  } as never);
};

describe("assistant response polling", () => {
  it("waits for the final message snapshot after a run becomes terminal", () => {
    expect(interval("completed", "running")).toBe(1000);
    expect(interval("completed", "complete")).toBe(false);
  });

  it("keeps progress live while work is active and stops after cancellation is reflected", () => {
    expect(interval("running", "running")).toBe(1000);
    expect(interval("cancelled", "running")).toBe(1000);
    expect(interval("cancelled", "cancelled")).toBe(false);
  });
});
