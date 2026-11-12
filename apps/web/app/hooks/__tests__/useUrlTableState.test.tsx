import { renderHook } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { useUrlTableState } from "../useUrlTableState";

const STATUS_VALUES = ["active", "archived"];
const FILTER_KEYS = ["status", "role"] as const;

const renderTableState = (url: string) =>
  renderHook(
    () =>
      useUrlTableState({
        filterKeys: FILTER_KEYS,
        filterValidators: { status: (value) => STATUS_VALUES.includes(value) },
      }),
    {
      wrapper: ({ children }) => <MemoryRouter initialEntries={[url]}>{children}</MemoryRouter>,
    },
  );

describe("useUrlTableState", () => {
  it("keeps filter values that pass their validator", () => {
    const { result } = renderTableState("/users?status=archived&role=admin");

    expect(result.current.filters).toEqual({ status: "archived", role: "admin" });
    expect(result.current.activeFilterCount).toBe(2);
  });

  it("ignores filter values that fail their validator and does not count them", () => {
    const { result } = renderTableState("/users?status=bogus");

    expect(result.current.filters.status).toBeUndefined();
    expect(result.current.activeFilterCount).toBe(0);
  });
});
