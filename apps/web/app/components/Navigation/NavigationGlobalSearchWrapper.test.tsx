import { GLOBAL_SEARCH_MODES } from "@repo/shared";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NavigationGlobalSearchWrapper } from "./NavigationGlobalSearchWrapper";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
const aiConfiguration = vi.hoisted(() => ({
  data: { enabled: true } as { enabled: boolean } | undefined,
}));
vi.mock("~/api/queries/useAIConfigured", () => ({
  useAIConfigured: () => ({ data: aiConfiguration.data }),
}));
vi.mock("../../api/queries/useGlobalSettings", () => ({ useGlobalSettings: () => ({ data: {} }) }));
vi.mock("~/hooks/useHandleKeyboardShortcut", () => ({ useHandleKeyboardShortcut: vi.fn() }));
vi.mock("../ui/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? children : null,
  DialogContent: ({
    children,
    onKeyDown,
  }: {
    children: React.ReactNode;
    onKeyDown: React.KeyboardEventHandler;
  }) => (
    // Mirrors the Radix dialog keyboard event boundary.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div role="dialog" tabIndex={-1} onKeyDown={onKeyDown}>
      {children}
    </div>
  ),
}));
const selectResult = vi.fn();
vi.mock("./GlobalSearch/GlobalSearchResults", () => ({
  GlobalSearchResults: ({
    debouncedSearch,
    mode,
    isDebouncing,
    setTotalItems,
  }: {
    debouncedSearch: string;
    mode: string;
    isDebouncing: boolean;
    setTotalItems: (count: number) => void;
  }) => {
    setTotalItems(1);
    return (
      <div>
        <output data-testid="request">
          {JSON.stringify({ query: debouncedSearch, mode, isDebouncing })}
        </output>
        <div data-search-index="0">
          <button onClick={selectResult}>Result</button>
        </div>
      </div>
    );
  },
}));

const openSearch = () => {
  render(<NavigationGlobalSearchWrapper />);
  fireEvent.click(screen.getByRole("button", { name: "navigationSideBar.findInApplication" }));
  return screen.getByRole("textbox", { name: "globalSearch.search" });
};

const askAi = () => screen.getByRole("button", { name: /^globalSearch\.aiSearch:/ });
const queryAskAi = () => screen.queryByRole("button", { name: /^globalSearch\.aiSearch:/ });

const request = () => JSON.parse(screen.getByTestId("request").textContent ?? "{}");

describe("global search mode", () => {
  beforeEach(() => {
    aiConfiguration.data = { enabled: true };
    vi.useFakeTimers();
    selectResult.mockClear();
  });

  it("hides the AI row when AI is not configured and keeps keyword search working", () => {
    aiConfiguration.data = { enabled: false };
    const input = openSearch();
    fireEvent.change(input, { target: { value: "policy" } });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(queryAskAi()).not.toBeInTheDocument();
    expect(request()).toEqual({
      query: "policy",
      mode: GLOBAL_SEARCH_MODES.KEYWORD,
      isDebouncing: false,
    });
    fireEvent.click(screen.getByRole("button", { name: "globalSearch.clear" }));
    expect(input).toHaveValue("");
  });

  it("keeps the AI row hidden until configuration is known", () => {
    aiConfiguration.data = undefined;
    const input = openSearch();
    fireEvent.change(input, { target: { value: "policy" } });
    expect(queryAskAi()).not.toBeInTheDocument();
  });

  it("returns to keyword mode if configuration is removed during hybrid search", () => {
    const view = render(<NavigationGlobalSearchWrapper />);
    fireEvent.click(screen.getByRole("button", { name: "navigationSideBar.findInApplication" }));
    fireEvent.change(screen.getByRole("textbox", { name: "globalSearch.search" }), {
      target: { value: "policy" },
    });
    fireEvent.click(askAi());
    expect(request().mode).toBe(GLOBAL_SEARCH_MODES.HYBRID);
    aiConfiguration.data = { enabled: false };
    view.rerender(<NavigationGlobalSearchWrapper />);
    expect(request().mode).toBe(GLOBAL_SEARCH_MODES.KEYWORD);
    expect(queryAskAi()).not.toBeInTheDocument();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("submits the current trimmed text before debounce and resets to keywords on edits", () => {
    const input = openSearch();
    fireEvent.change(input, { target: { value: "old query" } });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    fireEvent.change(input, { target: { value: "  current meaning  " } });
    expect(request().isDebouncing).toBe(true);
    fireEvent.click(askAi());
    expect(request()).toEqual({
      query: "current meaning",
      mode: GLOBAL_SEARCH_MODES.HYBRID,
      isDebouncing: false,
    });
    expect(queryAskAi()).not.toBeInTheDocument();
    fireEvent.change(input, { target: { value: "new query" } });
    expect(request().mode).toBe(GLOBAL_SEARCH_MODES.KEYWORD);
    expect(askAi()).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(request()).toEqual({
      query: "new query",
      mode: GLOBAL_SEARCH_MODES.KEYWORD,
      isDebouncing: false,
    });
  });

  it("does not let Enter on the AI row select a result", () => {
    const input = openSearch();
    fireEvent.change(input, { target: { value: "meaning" } });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    fireEvent.keyDown(askAi(), { key: "Enter" });
    expect(selectResult).not.toHaveBeenCalled();
    expect(askAi()).toHaveAttribute("aria-keyshortcuts", "Meta+Enter Control+Enter");
  });

  it.each(["metaKey", "ctrlKey"] as const)(
    "runs AI search with %s+Enter before debounce",
    (modifier) => {
      const input = openSearch();
      fireEvent.change(input, { target: { value: "  policy meaning  " } });
      fireEvent.keyDown(input, { key: "Enter", [modifier]: true });
      expect(request()).toEqual({
        query: "policy meaning",
        mode: GLOBAL_SEARCH_MODES.HYBRID,
        isDebouncing: false,
      });
      fireEvent.keyDown(input, { key: "Enter", [modifier]: true });
      expect(request().mode).toBe(GLOBAL_SEARCH_MODES.HYBRID);
      expect(selectResult).not.toHaveBeenCalled();
    },
  );

  it("does not run AI search from the shortcut without configuration", () => {
    aiConfiguration.data = { enabled: false };
    const input = openSearch();
    fireEvent.change(input, { target: { value: "how do refunds work" } });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    fireEvent.keyDown(input, { key: "Enter", ctrlKey: true });
    expect(request().mode).toBe(GLOBAL_SEARCH_MODES.KEYWORD);
    fireEvent.keyDown(input, { key: "Enter" });
    expect(selectResult).toHaveBeenCalledOnce();
  });

  it("keeps Enter on the top match for title-like queries; ArrowUp reaches the AI row", () => {
    const input = openSearch();
    fireEvent.change(input, { target: { value: "policy" } });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(askAi()).not.toHaveAttribute("aria-current");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(selectResult).toHaveBeenCalledOnce();
  });

  it("reaches the AI row with ArrowUp from the top match", () => {
    const input = openSearch();
    fireEvent.change(input, { target: { value: "refund" } });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(askAi()).toHaveAttribute("aria-current", "true");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(request().mode).toBe(GLOBAL_SEARCH_MODES.HYBRID);
    expect(selectResult).not.toHaveBeenCalled();
  });

  it("highlights the AI row for questions so Enter runs AI, and ArrowDown returns to results", () => {
    const input = openSearch();
    fireEvent.change(input, { target: { value: "how do refunds work" } });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(askAi()).toHaveAttribute("aria-current", "true");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(askAi()).not.toHaveAttribute("aria-current");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(selectResult).toHaveBeenCalledOnce();
  });

  it("runs AI with Enter for a one-word question", () => {
    const input = openSearch();
    fireEvent.change(input, { target: { value: "refunds?" } });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(request()).toEqual({
      query: "refunds?",
      mode: GLOBAL_SEARCH_MODES.HYBRID,
      isDebouncing: false,
    });
  });

  it("requires three trimmed characters and clears the mode with the query", () => {
    const input = openSearch();
    fireEvent.change(input, { target: { value: " ab " } });
    expect(queryAskAi()).not.toBeInTheDocument();
    fireEvent.change(input, { target: { value: "abc" } });
    fireEvent.click(askAi());
    expect(request().mode).toBe(GLOBAL_SEARCH_MODES.HYBRID);
    fireEvent.click(screen.getByRole("button", { name: "globalSearch.clear" }));
    expect(input).toHaveValue("");
    expect(screen.queryByTestId("request")).not.toBeInTheDocument();
  });

  it("limits both keyword and hybrid requests to 500 characters", () => {
    const input = openSearch();
    expect(input).toHaveAttribute("maxlength", "500");
    fireEvent.change(input, { target: { value: "x".repeat(501) } });
    expect(input).toHaveValue("x".repeat(500));
    fireEvent.click(askAi());
    expect(request().query).toHaveLength(500);
  });
});
