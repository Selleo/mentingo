import { arrayMove } from "@dnd-kit/sortable";

import type { DashboardWidgetLayout, DashboardWidgetId } from "./dashboard.types";

export function setDashboardWidgetEnabled(
  widgets: DashboardWidgetLayout[],
  widgetId: DashboardWidgetId,
  enabled: boolean,
) {
  return widgets.map((widget) => {
    if (widget.widgetId !== widgetId) {
      return widget;
    }

    return {
      ...widget,
      enabled,
    };
  });
}

export function reorderDashboardWidgets(
  widgets: DashboardWidgetLayout[],
  activeWidgetId: string,
  overWidgetId: string,
) {
  const orderedWidgets = [...widgets].sort((first, second) => first.order - second.order);
  const activeIndex = orderedWidgets.findIndex(({ widgetId }) => widgetId === activeWidgetId);
  const overIndex = orderedWidgets.findIndex(({ widgetId }) => widgetId === overWidgetId);

  if (activeIndex === -1 || overIndex === -1 || activeIndex === overIndex) {
    return orderedWidgets;
  }

  return arrayMove(orderedWidgets, activeIndex, overIndex).map((widget, index) => ({
    ...widget,
    order: index + 1,
  }));
}
