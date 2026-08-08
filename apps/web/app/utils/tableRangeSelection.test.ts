import { describe, expect, it, vi } from "vitest";

import { handleRowSelectionRange } from "./tableRangeSelection";

import type { Row, Table } from "@tanstack/react-table";
import type React from "react";

describe("handleRowSelectionRange", () => {
  it("selects the visible range after rows have been sorted", () => {
    const selection = new Map<string, boolean>();
    const visibleRows = [
      { id: "first", index: 4 },
      { id: "middle", index: 1 },
      { id: "last", index: 7 },
    ].map(
      ({ id, index }) =>
        ({
          id,
          index,
          toggleSelected: (value: boolean) => selection.set(id, value),
        }) as unknown as Row<unknown>,
    );
    const rowsById = new Map(visibleRows.map((row) => [row.id, row]));
    const table = {
      getRow: (id: string) => rowsById.get(id),
      getRowModel: () => ({ rows: visibleRows }),
    } as Table<unknown>;
    let lastSelectedRowIndex = 0;
    const setLastSelectedRowIndex = vi.fn((index: number) => {
      lastSelectedRowIndex = index;
    });

    handleRowSelectionRange({
      table,
      event: { shiftKey: false } as React.MouseEvent<HTMLButtonElement>,
      id: "first",
      value: false,
      lastSelectedRowIndex,
      setLastSelectedRowIndex,
    });
    handleRowSelectionRange({
      table,
      event: { shiftKey: true } as React.MouseEvent<HTMLButtonElement>,
      id: "last",
      value: false,
      lastSelectedRowIndex,
      setLastSelectedRowIndex,
    });

    expect(setLastSelectedRowIndex).toHaveBeenCalledWith(0);
    expect(Object.fromEntries(selection)).toEqual({
      first: true,
      middle: true,
      last: true,
    });
  });
});
