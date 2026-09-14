import { act, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { SearchFilter } from "./SearchFilter";

import type { FilterConfig } from "./SearchFilter";

const filters: FilterConfig[] = [
  { name: "search", type: "text", testId: "search" },
  { name: "type", type: "select", options: [{ value: "practice", label: "Practice" }] },
];

describe("SearchFilter URL integration", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("debounces typing and uses the current callback after rerender", () => {
    const oldChange = vi.fn();
    const currentChange = vi.fn();
    const view = renderWith().render(
      <SearchFilter filters={filters} values={{}} onChange={oldChange} />,
    );
    fireEvent.change(screen.getByTestId("search"), { target: { value: "history" } });
    view.rerender(<SearchFilter filters={filters} values={{}} onChange={currentChange} />);
    act(() => vi.advanceTimersByTime(300));
    expect(oldChange).not.toHaveBeenCalled();
    expect(currentChange).toHaveBeenCalledWith("search", "history");
  });

  it("clears all filters atomically and cancels pending search", () => {
    const onChange = vi.fn();
    const onClearAll = vi.fn();
    renderWith().render(
      <SearchFilter
        filters={filters}
        values={{ type: "practice" }}
        onChange={onChange}
        onClearAll={onClearAll}
        clearAllTestId="clear"
      />,
    );
    fireEvent.change(screen.getByTestId("search"), { target: { value: "pending" } });
    fireEvent.click(screen.getByTestId("clear"));
    act(() => vi.advanceTimersByTime(300));
    expect(onClearAll).toHaveBeenCalledOnce();
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByTestId("search")).toHaveValue("");
  });

  it("reflects browser-back values and cancels stale pending input", () => {
    const onChange = vi.fn();
    const view = renderWith().render(
      <SearchFilter filters={filters} values={{ search: "current" }} onChange={onChange} />,
    );
    fireEvent.change(screen.getByTestId("search"), { target: { value: "pending" } });
    view.rerender(
      <SearchFilter filters={filters} values={{ search: "previous" }} onChange={onChange} />,
    );
    expect(screen.getByTestId("search")).toHaveValue("previous");
    act(() => vi.advanceTimersByTime(300));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("cancels pending navigation when the filter is unmounted", () => {
    const onChange = vi.fn();
    const view = renderWith().render(
      <SearchFilter filters={filters} values={{}} onChange={onChange} />,
    );
    fireEvent.change(screen.getByTestId("search"), { target: { value: "pending" } });
    view.unmount();
    act(() => vi.advanceTimersByTime(300));
    expect(onChange).not.toHaveBeenCalled();
  });
});
