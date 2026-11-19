import { act, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { LearningPathsSearchInput } from "./LearningPathsSearchInput";

const router = vi.hoisted(() => ({ params: new URLSearchParams(), navigate: vi.fn() }));
vi.mock("@remix-run/react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@remix-run/react")>()),
  useSearchParams: () => [router.params, router.navigate],
}));

beforeEach(() => {
  vi.useFakeTimers();
  router.params = new URLSearchParams();
  router.navigate.mockReset();
});
afterEach(() => vi.useRealTimers());

const advance = () => act(() => vi.advanceTimersByTime(300));
const commit = (rerender: () => void, index = 0) => {
  const [update] = router.navigate.mock.calls[index];
  router.params = typeof update === "function" ? update(router.params) : update;
  rerender();
};

describe("learning paths search", () => {
  it("hydrates external navigation and cancels pending typing", () => {
    router.params = new URLSearchParams("searchQuery=current");
    const view = renderWith().render(<LearningPathsSearchInput />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "unfinished" } });
    router.params = new URLSearchParams("searchQuery=bookmarked&create=true");
    view.rerender(<LearningPathsSearchInput />);
    expect(input).toHaveValue("bookmarked");
    advance();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it("preserves unrelated URL parameters when searching and clearing", () => {
    router.params = new URLSearchParams("create=true");
    const view = renderWith().render(<LearningPathsSearchInput />);
    const input = screen.getByRole("textbox");
    for (const value of ["  history  ", ""]) {
      fireEvent.change(input, { target: { value } });
      advance();
      commit(
        () => view.rerender(<LearningPathsSearchInput />),
        router.navigate.mock.calls.length - 1,
      );
      expect(router.params.get("create")).toBe("true");
      expect(router.params.get("searchQuery") ?? "").toBe(value.trim());
      expect(input).toHaveValue(value);
    }
  });
  it("preserves the draft through multiple outstanding URL commits", () => {
    const view = renderWith().render(<LearningPathsSearchInput />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "m.hubert@sel" } });
    advance();
    fireEvent.change(input, { target: { value: "m.hubert@selleo" } });
    advance();
    fireEvent.change(input, { target: { value: "m.hubert@selleo.com" } });
    commit(() => view.rerender(<LearningPathsSearchInput />));
    expect(input).toHaveValue("m.hubert@selleo.com");
    commit(() => view.rerender(<LearningPathsSearchInput />), 1);
    expect(input).toHaveValue("m.hubert@selleo.com");
  });
  it("preserves newer input when an earlier URL navigation finishes", () => {
    const view = renderWith().render(<LearningPathsSearchInput />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "m.hubert@sel" } });
    advance();
    fireEvent.change(input, { target: { value: "m.hubert@selleo.com" } });
    commit(() => view.rerender(<LearningPathsSearchInput />));
    expect(input).toHaveValue("m.hubert@selleo.com");
    advance();
    commit(() => view.rerender(<LearningPathsSearchInput />), 1);
    expect(router.params.get("searchQuery")).toBe("m.hubert@selleo.com");
  });
});
