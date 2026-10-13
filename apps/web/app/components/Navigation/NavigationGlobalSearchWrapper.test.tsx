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
  }: {
    debouncedSearch: string;
    mode: string;
    isDebouncing: boolean;
  }) => (
    <div>
      <output data-testid="request">
        {JSON.stringify({ query: debouncedSearch, mode, isDebouncing })}
      </output>
      <div data-search-index="0">
        <button onClick={selectResult}>Result</button>
      </div>
    </div>
  ),
}));

const openSearch = () => {
  render(<NavigationGlobalSearchWrapper />);
  fireEvent.click(screen.getByRole("button", { name: "navigationSideBar.findInApplication" }));
  return screen.getByRole("textbox", { name: "globalSearch.search" });
};

const request = () => JSON.parse(screen.getByTestId("request").textContent ?? "{}");

describe("global search mode", () => {
  beforeEach(() => {
    aiConfiguration.data = { enabled: true };
    vi.useFakeTimers();
    selectResult.mockClear();
  });

  it("hides semantic search when AI is not configured and keeps keyword search working", () => {
    aiConfiguration.data = { enabled: false };
    const input = openSearch();
    expect(
      screen.queryByRole("button", { name: "globalSearch.searchByMeaning" }),
    ).not.toBeInTheDocument();
    fireEvent.change(input, { target: { value: "policy" } });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(request()).toEqual({ query: "policy", mode: "keyword", isDebouncing: false });
    fireEvent.click(screen.getByRole("button", { name: "globalSearch.clear" }));
    expect(input).toHaveValue("");
  });

  it("keeps the sparkle hidden until configuration is known", () => {
    aiConfiguration.data = undefined;
    openSearch();
    expect(
      screen.queryByRole("button", { name: "globalSearch.searchByMeaning" }),
    ).not.toBeInTheDocument();
  });

  it("returns to keyword mode if configuration is removed during hybrid search", () => {
    const view = render(<NavigationGlobalSearchWrapper />);
    fireEvent.click(screen.getByRole("button", { name: "navigationSideBar.findInApplication" }));
    fireEvent.change(screen.getByRole("textbox", { name: "globalSearch.search" }), {
      target: { value: "policy" },
    });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    fireEvent.click(screen.getByRole("button", { name: "globalSearch.searchByMeaning" }));
    expect(request().mode).toBe("hybrid");
    aiConfiguration.data = { enabled: false };
    view.rerender(<NavigationGlobalSearchWrapper />);
    expect(request().mode).toBe("keyword");
    expect(
      screen.queryByRole("button", { name: "globalSearch.searchByMeaning" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("globalSearch.hybridSearch")).not.toBeInTheDocument();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("submits the current trimmed text before debounce and resets to keywords on edits", () => {
    const input = openSearch();
    fireEvent.change(input, { target: { value: "old query" } });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(request()).toEqual({ query: "old query", mode: "keyword", isDebouncing: false });
    fireEvent.change(input, { target: { value: "  current meaning  " } });
    expect(request().isDebouncing).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "globalSearch.searchByMeaning" }));
    expect(request()).toEqual({ query: "current meaning", mode: "hybrid", isDebouncing: false });
    fireEvent.change(input, { target: { value: "new query" } });
    expect(request().mode).toBe("keyword");
    expect(request().isDebouncing).toBe(true);
    expect(screen.queryByText("globalSearch.hybridSearch")).not.toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(request()).toEqual({ query: "new query", mode: "keyword", isDebouncing: false });
  });

  it("does not let Enter on the sparkle button select a result", () => {
    const input = openSearch();
    fireEvent.change(input, { target: { value: "meaning" } });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    const sparkle = screen.getByRole("button", { name: "globalSearch.searchByMeaning" });
    fireEvent.keyDown(sparkle, { key: "Enter" });
    expect(selectResult).not.toHaveBeenCalled();
    fireEvent.click(sparkle);
    expect(request().mode).toBe("hybrid");
  });

  it("requires three trimmed characters and clears the mode with the query", () => {
    const input = openSearch();
    fireEvent.change(input, { target: { value: " ab " } });
    expect(screen.getByRole("button", { name: "globalSearch.searchByMeaning" })).toBeDisabled();
    fireEvent.change(input, { target: { value: "abc" } });
    fireEvent.click(screen.getByRole("button", { name: "globalSearch.searchByMeaning" }));
    fireEvent.click(screen.getByRole("button", { name: "globalSearch.clear" }));
    expect(input).toHaveValue("");
    expect(screen.queryByTestId("request")).not.toBeInTheDocument();
    expect(screen.queryByText("globalSearch.hybridSearch")).not.toBeInTheDocument();
  });

  it("limits both keyword and hybrid requests to 500 characters", () => {
    const input = openSearch();
    expect(input).toHaveAttribute("maxlength", "500");
    fireEvent.change(input, { target: { value: "x".repeat(501) } });
    expect(input).toHaveValue("x".repeat(500));
    fireEvent.click(screen.getByRole("button", { name: "globalSearch.searchByMeaning" }));
    expect(request().query).toHaveLength(500);
    act(() => {
      vi.advanceTimersByTime(300);
    });
    fireEvent.click(screen.getByRole("button", { name: "globalSearch.backToKeywords" }));
    expect(request().query).toHaveLength(500);
  });

  it("returns to keyword search explicitly", () => {
    const input = openSearch();
    fireEvent.change(input, { target: { value: "meaning" } });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    fireEvent.click(screen.getByRole("button", { name: "globalSearch.searchByMeaning" }));
    fireEvent.click(screen.getByRole("button", { name: "globalSearch.backToKeywords" }));
    expect(request().mode).toBe("keyword");
  });
});
