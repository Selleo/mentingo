import { act, renderHook, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useUrlTableState } from "../useUrlTableState";

const router = vi.hoisted(() => ({ params: new URLSearchParams(), navigate: vi.fn() }));
vi.mock("@remix-run/react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@remix-run/react")>()),
  useSearchParams: () => [router.params, router.navigate],
}));

const FILTER_KEYS = ["status"] as const;
const renderState = () => renderHook(() => useUrlTableState({ filterKeys: FILTER_KEYS }));
const advance = () => act(() => vi.advanceTimersByTime(300));
const commitNavigation = (rerender: () => void, index = 0) => {
  const [update] = router.navigate.mock.calls[index];
  router.params = typeof update === "function" ? update(router.params) : update;
  rerender();
};

beforeEach(() => {
  vi.useFakeTimers();
  router.params = new URLSearchParams("status=active&page=3");
  router.navigate.mockReset();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("table search while URL navigation is delayed", () => {
  it.each([
    ["m.hubert@sel", ""],
    ["m.hubert@selleo.com", "m.hubert@selleo.co"],
    ["m.hubert@selleo.com", "m.xhubert@selleo.com"],
    ["m.hubert@sel", "  m.hubert@selleo.com  "],
  ])("preserves an edit from %s to %s across an earlier acknowledgment", (previous, draft) => {
    const { result, rerender } = renderState();
    act(() => result.current.setSearchInput(previous));
    advance();
    act(() => result.current.setSearchInput(draft));
    commitNavigation(rerender);
    expect(result.current.searchInput).toBe(draft);
    advance();
    commitNavigation(rerender, 1);
    expect(result.current.search).toBe(draft.trim());
    expect(result.current.searchInput).toBe(draft);
  });

  it("hydrates browser navigation after acknowledging a local search", () => {
    const { result, rerender } = renderState();
    act(() => result.current.setSearchInput("first"));
    advance();
    commitNavigation(rerender);
    act(() => result.current.setSearchInput("second"));
    advance();
    commitNavigation(rerender, 1);
    router.params = new URLSearchParams("search=first");
    rerender();
    expect(result.current.searchInput).toBe("first");
    advance();
    expect(router.navigate).toHaveBeenCalledTimes(2);
  });
  it("keeps the draft when multiple debounced navigations are in flight", () => {
    const { result, rerender } = renderState();
    act(() => result.current.setSearchInput("m.hubert@sel"));
    advance();
    act(() => result.current.setSearchInput("m.hubert@selleo"));
    advance();
    act(() => result.current.setSearchInput("m.hubert@selleo.com"));
    commitNavigation(rerender);
    expect(result.current.searchInput).toBe("m.hubert@selleo.com");
    commitNavigation(rerender, 1);
    expect(result.current.searchInput).toBe("m.hubert@selleo.com");
    advance();
    commitNavigation(rerender, 2);
    expect(result.current.search).toBe("m.hubert@selleo.com");
  });

  it("hydrates an external search without writing it back or reviving pending text", () => {
    const { result, rerender } = renderState();
    act(() => result.current.setSearchInput("unfinished"));
    router.params = new URLSearchParams("search=bookmarked&status=active");
    rerender();
    expect(result.current.searchInput).toBe("bookmarked");
    advance();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it("does not restore a pending search after resetting filters", () => {
    const { result, rerender } = renderState();
    act(() => result.current.setSearchInput("m.hubert@selleo.com"));
    advance();
    act(() => result.current.resetFilters());
    commitNavigation(rerender, 1);
    advance();
    expect(result.current.searchInput).toBe("");
    expect(result.current.search).toBe("");
    expect(router.navigate).toHaveBeenCalledTimes(2);
  });

  it("does not replace newer keystrokes with an earlier debounced URL value", () => {
    const { result, rerender } = renderState();
    act(() => result.current.setSearchInput("m.hubert@sel"));
    advance();
    act(() => result.current.setSearchInput("m.hubert@selleo.com"));
    commitNavigation(rerender);

    expect(result.current.searchInput).toBe("m.hubert@selleo.com");
    advance();
    commitNavigation(rerender, 1);
    expect(result.current.search).toBe("m.hubert@selleo.com");
    expect(result.current.searchInput).toBe("m.hubert@selleo.com");
    expect(router.params.get("status")).toBe("active");
    expect(router.params.has("page")).toBe(false);
  });
});
