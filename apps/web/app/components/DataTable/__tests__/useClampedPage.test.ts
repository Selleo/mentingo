import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useClampedPage } from "../useClampedPage";

describe("useClampedPage", () => {
  it("keeps the requested page while the total is still unknown", () => {
    const setPage = vi.fn();

    renderHook(() => useClampedPage({ page: 3, perPage: 10, totalItems: undefined, setPage }));

    expect(setPage).not.toHaveBeenCalled();
  });

  it("moves to the last existing page once the total is known", () => {
    const setPage = vi.fn();

    renderHook(() => useClampedPage({ page: 5, perPage: 10, totalItems: 25, setPage }));

    expect(setPage).toHaveBeenCalledWith(3);
  });

  it("keeps a page that still exists", () => {
    const setPage = vi.fn();

    renderHook(() => useClampedPage({ page: 3, perPage: 10, totalItems: 25, setPage }));

    expect(setPage).not.toHaveBeenCalled();
  });
});
