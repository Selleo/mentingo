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

  it.each([
    ["Macintosh", "⌘↵"],
    ["Windows", "Ctrl+↵"],
  ])("shows the AI keyboard hint in the footer on %s", (platform, shortcut) => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(platform);
    openSearch();
    expect(screen.getByText(shortcut).tagName).toBe("KBD");
    expect(screen.getByRole("button", { name: "globalSearch.aiSearch" })).toHaveTextContent(
      "globalSearch.aiSearch",
    );
  });

  it("hides semantic search when AI is not configured and keeps keyword search working", () => {
    aiConfiguration.data = { enabled: false };
    const input = openSearch();
    expect(screen.queryByText("globalSearch.aiSearch")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "globalSearch.aiSearch" })).not.toBeInTheDocument();
    fireEvent.change(input, { target: { value: "policy" } });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(request()).toEqual({
      query: "policy",
      mode: GLOBAL_SEARCH_MODES.KEYWORD,
      isDebouncing: false,
    });
    fireEvent.click(screen.getByRole("button", { name: "globalSearch.clear" }));
    expect(input).toHaveValue("");
  });

  it("keeps the sparkle hidden until configuration is known", () => {
    aiConfiguration.data = undefined;
    openSearch();
    expect(screen.queryByRole("button", { name: "globalSearch.aiSearch" })).not.toBeInTheDocument();
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
    fireEvent.click(screen.getByRole("button", { name: "globalSearch.aiSearch" }));
    expect(request().mode).toBe(GLOBAL_SEARCH_MODES.HYBRID);
    aiConfiguration.data = { enabled: false };
    view.rerender(<NavigationGlobalSearchWrapper />);
    expect(request().mode).toBe(GLOBAL_SEARCH_MODES.KEYWORD);
    expect(screen.queryByRole("button", { name: "globalSearch.aiSearch" })).not.toBeInTheDocument();
    expect(screen.queryByText("globalSearch.hybridSearch")).not.toBeInTheDocument();
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
    expect(request()).toEqual({
      query: "old query",
      mode: GLOBAL_SEARCH_MODES.KEYWORD,
      isDebouncing: false,
    });
    fireEvent.change(input, { target: { value: "  current meaning  " } });
    expect(request().isDebouncing).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "globalSearch.aiSearch" }));
    expect(request()).toEqual({
      query: "current meaning",
      mode: GLOBAL_SEARCH_MODES.HYBRID,
      isDebouncing: false,
    });
    fireEvent.change(input, { target: { value: "new query" } });
    expect(request().mode).toBe(GLOBAL_SEARCH_MODES.KEYWORD);
    expect(request().isDebouncing).toBe(true);
    expect(screen.queryByText("globalSearch.hybridSearch")).not.toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(request()).toEqual({
      query: "new query",
      mode: GLOBAL_SEARCH_MODES.KEYWORD,
      isDebouncing: false,
    });
  });

  it("does not let Enter on the sparkle button select a result", () => {
    const input = openSearch();
    fireEvent.change(input, { target: { value: "meaning" } });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    const sparkle = screen.getByRole("button", { name: "globalSearch.aiSearch" });
    fireEvent.keyDown(sparkle, { key: "Enter" });
    expect(selectResult).not.toHaveBeenCalled();
    fireEvent.click(sparkle);
    expect(request().mode).toBe(GLOBAL_SEARCH_MODES.HYBRID);
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
      expect(selectResult).not.toHaveBeenCalled();
      fireEvent.keyDown(input, { key: "Enter", [modifier]: true });
      expect(request().mode).toBe(GLOBAL_SEARCH_MODES.HYBRID);
      expect(selectResult).not.toHaveBeenCalled();
    },
  );

  it("does not run AI search from the shortcut without configuration or enough text", () => {
    aiConfiguration.data = { enabled: false };
    const input = openSearch();
    fireEvent.change(input, { target: { value: "policy" } });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    fireEvent.keyDown(input, { key: "Enter", ctrlKey: true });
    expect(request().mode).toBe(GLOBAL_SEARCH_MODES.KEYWORD);
    expect(selectResult).not.toHaveBeenCalled();
  });

  it("keeps ordinary Enter selecting the result", () => {
    const input = openSearch();
    fireEvent.change(input, { target: { value: "policy" } });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(selectResult).toHaveBeenCalledOnce();
  });

  it("requires three trimmed characters and clears the mode with the query", () => {
    const input = openSearch();
    fireEvent.change(input, { target: { value: " ab " } });
    expect(screen.getByRole("button", { name: "globalSearch.aiSearch" })).toBeDisabled();
    fireEvent.change(input, { target: { value: "abc" } });
    fireEvent.click(screen.getByRole("button", { name: "globalSearch.aiSearch" }));
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
    fireEvent.click(screen.getByRole("button", { name: "globalSearch.aiSearch" }));
    expect(request().query).toHaveLength(500);
    act(() => {
      vi.advanceTimersByTime(300);
    });
    fireEvent.click(screen.getByRole("button", { name: "globalSearch.aiSearch" }));
    expect(request().query).toHaveLength(500);
  });

  it("exposes the AI shortcut and returns to keyword search from the same button", () => {
    const input = openSearch();
    fireEvent.change(input, { target: { value: "meaning" } });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    const toggle = screen.getByRole("button", { name: "globalSearch.aiSearch" });
    expect(toggle).toHaveAttribute("aria-keyshortcuts", "Meta+Enter Control+Enter");
    expect(toggle.getAttribute("title")).toContain("Enter");
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(toggle.getAttribute("title")).toContain("globalSearch.backToKeywords");
    expect(screen.queryByText("globalSearch.hybridSearch")).not.toBeInTheDocument();
    expect(screen.queryByText("globalSearch.backToKeywords")).not.toBeInTheDocument();
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(request().mode).toBe(GLOBAL_SEARCH_MODES.KEYWORD);
  });
});
