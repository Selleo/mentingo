import type { Table } from "@tanstack/react-table";
import type React from "react";

export function handleRowSelectionRange<TData>(params: {
  table: Table<TData>;
  event: React.MouseEvent<HTMLButtonElement>;
  id: string;
  value: boolean;
  lastSelectedRowIndex: number;
  setLastSelectedRowIndex: (n: number) => void;
}): void {
  const { table, event, id, value, lastSelectedRowIndex, setLastSelectedRowIndex } = params;
  const shiftKeyPressed = event.shiftKey;
  const visibleRows = table.getRowModel().rows;
  const selectedRowIndex = visibleRows.findIndex((row) => row.id === id);

  if (selectedRowIndex < 0) return;

  if (!shiftKeyPressed) {
    table.getRow(id).toggleSelected(!value);
    setLastSelectedRowIndex(selectedRowIndex);
    return;
  }

  const start = Math.min(selectedRowIndex, lastSelectedRowIndex);
  const end = Math.max(selectedRowIndex, lastSelectedRowIndex);

  visibleRows.slice(start, end + 1).forEach((row) => row.toggleSelected(!value));
}
