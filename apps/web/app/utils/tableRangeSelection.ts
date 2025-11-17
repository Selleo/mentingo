import type { Table } from "@tanstack/react-table";
import type React from "react";

export function handleRowSelectionRange<TData>(params: {
  table: Table<TData>;
  event: React.MouseEvent<HTMLButtonElement>;
  id: string;
  idx: number;
  value: boolean;
  lastSelectedRowIndex: number;
  setLastSelectedRowIndex: (n: number) => void;
}): void {
  const { table, event, id, idx, value, lastSelectedRowIndex, setLastSelectedRowIndex } = params;
  const shiftKeyPressed = event.shiftKey;

  if (!shiftKeyPressed) {
    table.getRow(id).toggleSelected(!value);
    setLastSelectedRowIndex(idx);
    return;
  }

  const start = Math.min(idx, lastSelectedRowIndex);
  const end = Math.max(idx, lastSelectedRowIndex);

  table
    .getRowModel()
    .rows.filter((row) => row.index >= start && row.index <= end)
    .forEach((row) => row.toggleSelected(!value));
}
