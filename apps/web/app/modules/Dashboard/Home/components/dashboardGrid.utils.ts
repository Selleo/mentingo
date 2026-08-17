import { arrayMove } from "@dnd-kit/sortable";

import { dashboardSizeToSpan } from "../types";

import type { DashboardLayoutItem } from "../types";
import type { DashboardWidgetId } from "@repo/shared";

export const DASHBOARD_DROP_PLACEMENTS = {
  BEFORE: "before",
  AFTER: "after",
} as const;

export type DropPlacement =
  (typeof DASHBOARD_DROP_PLACEMENTS)[keyof typeof DASHBOARD_DROP_PLACEMENTS];

export type DashboardGridPlacement = {
  id: DashboardWidgetId;
  column: number;
  row: number;
  columns: number;
  rows: number;
};

/**
 * Deterministically places semantic widget spans in row-major order. The
 * persisted array remains the source of truth for order; this function only
 * calculates visual coordinates.
 */
export const packDashboardWidgets = (
  widgets: DashboardLayoutItem[],
  columns: number,
): DashboardGridPlacement[] => {
  if (columns < 1) return [];
  const occupied: boolean[][] = [];
  const canFit = (row: number, column: number, rows: number, spanColumns: number) => {
    if (column + spanColumns > columns) return false;
    for (let y = row; y < row + rows; y += 1) {
      for (let x = column; x < column + spanColumns; x += 1) {
        if (occupied[y]?.[x]) return false;
      }
    }
    return true;
  };
  const mark = (row: number, column: number, rows: number, spanColumns: number) => {
    for (let y = row; y < row + rows; y += 1) {
      occupied[y] ??= [];
      for (let x = column; x < column + spanColumns; x += 1) occupied[y][x] = true;
    }
  };

  return widgets.map((widget) => {
    const span = dashboardSizeToSpan(widget.size);
    const spanColumns = Math.min(span.columns, columns);
    let row = 0;
    let column = 0;
    while (!canFit(row, column, span.rows, spanColumns)) {
      column += 1;
      if (column + spanColumns > columns) {
        column = 0;
        row += 1;
      }
    }
    mark(row, column, span.rows, spanColumns);
    return { id: widget.id, column, row, columns: spanColumns, rows: span.rows };
  });
};

/**
 * Determines whether a dragged widget should be inserted before or after the
 * wider widget under the pointer, while keeping the decision stable near the
 * midpoint of that widget.
 */
export const getDashboardDropPlacement = (
  pointerX: number,
  targetRect: { left: number; width: number } | undefined,
  activeRect: { width: number } | null,
  previousPlacement: DropPlacement | null = null,
): DropPlacement | null => {
  if (!targetRect || !activeRect || targetRect.width <= activeRect.width * 1.5) return null;

  const pointerRatio = (pointerX - targetRect.left) / targetRect.width;
  if (previousPlacement === DASHBOARD_DROP_PLACEMENTS.BEFORE && pointerRatio < 0.6) {
    return DASHBOARD_DROP_PLACEMENTS.BEFORE;
  }
  if (previousPlacement === DASHBOARD_DROP_PLACEMENTS.AFTER && pointerRatio > 0.4) {
    return DASHBOARD_DROP_PLACEMENTS.AFTER;
  }

  return pointerRatio >= 0.5 ? DASHBOARD_DROP_PLACEMENTS.AFTER : DASHBOARD_DROP_PLACEMENTS.BEFORE;
};

/**
 * Reorders dashboard widgets and rewrites their order values to match the
 * resulting array so the draft can be persisted without stale positions.
 */
export const reorderDashboardWidgets = (
  widgets: DashboardLayoutItem[],
  activeId: DashboardWidgetId,
  overId: DashboardWidgetId,
  placement?: DropPlacement,
): DashboardLayoutItem[] => {
  const previousIndex = widgets.findIndex((widget) => widget.id === activeId);
  const nextIndex = widgets.findIndex((widget) => widget.id === overId);
  if (previousIndex < 0 || nextIndex < 0 || previousIndex === nextIndex) return widgets;

  let reorderedWidgets: DashboardLayoutItem[];
  if (placement) {
    const activeWidget = widgets[previousIndex];
    if (!activeWidget) return widgets;

    const widgetsWithoutActive = widgets.filter((widget) => widget.id !== activeId);
    const targetIndex = widgetsWithoutActive.findIndex((widget) => widget.id === overId);
    const insertionIndex = targetIndex + (placement === DASHBOARD_DROP_PLACEMENTS.AFTER ? 1 : 0);
    reorderedWidgets = [
      ...widgetsWithoutActive.slice(0, insertionIndex),
      activeWidget,
      ...widgetsWithoutActive.slice(insertionIndex),
    ];
  } else {
    reorderedWidgets = arrayMove(widgets, previousIndex, nextIndex);
  }

  if (reorderedWidgets.every((widget, index) => widget.id === widgets[index]?.id)) return widgets;

  return reorderedWidgets.map((widget, order) => ({
    ...widget,
    order,
  }));
};

/**
 * Projects the layout shown during a drag and reports whether the projected
 * order differs from the layout captured when dragging started.
 */
export const projectDashboardDragPreview = (
  initialWidgets: DashboardLayoutItem[],
  currentWidgets: DashboardLayoutItem[],
  activeId: DashboardWidgetId,
  overId: DashboardWidgetId,
  placement?: DropPlacement,
): { widgets: DashboardLayoutItem[]; hasChanged: boolean } => {
  const projectedWidgets = reorderDashboardWidgets(initialWidgets, activeId, overId, placement);
  const isCurrentPreview =
    currentWidgets.length === projectedWidgets.length &&
    currentWidgets.every((widget, index) => widget.id === projectedWidgets[index]?.id);

  return {
    widgets: isCurrentPreview ? currentWidgets : projectedWidgets,
    hasChanged: projectedWidgets !== initialWidgets,
  };
};
