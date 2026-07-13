import { reorderDashboardWidgets, setDashboardWidgetEnabled } from "./dashboard.utils";

import type { DashboardWidgetLayout } from "./dashboard.types";

const widgets: DashboardWidgetLayout[] = [
  {
    widgetId: "training-completion",
    order: 1,
    enabled: true,
    size: "large",
    settings: {},
  },
  {
    widgetId: "deadline-risks",
    order: 2,
    enabled: false,
    size: "medium",
    settings: {},
  },
  {
    widgetId: "event-calendar",
    order: 3,
    enabled: true,
    size: "medium",
    settings: {},
  },
];

describe("reorderDashboardWidgets", () => {
  it("moves a widget and normalizes the complete layout order", () => {
    const result = reorderDashboardWidgets(widgets, "event-calendar", "training-completion");

    expect(result.map(({ widgetId, order }) => ({ widgetId, order }))).toEqual([
      { widgetId: "event-calendar", order: 1 },
      { widgetId: "training-completion", order: 2 },
      { widgetId: "deadline-risks", order: 3 },
    ]);
  });

  it("does not mutate the layout received from the query", () => {
    reorderDashboardWidgets(widgets, "event-calendar", "training-completion");

    expect(widgets.map(({ widgetId }) => widgetId)).toEqual([
      "training-completion",
      "deadline-risks",
      "event-calendar",
    ]);
  });
});

describe("setDashboardWidgetEnabled", () => {
  it("updates only the selected widget", () => {
    const result = setDashboardWidgetEnabled(widgets, "deadline-risks", true);

    expect(result.map(({ widgetId, enabled }) => ({ widgetId, enabled }))).toEqual([
      { widgetId: "training-completion", enabled: true },
      { widgetId: "deadline-risks", enabled: true },
      { widgetId: "event-calendar", enabled: true },
    ]);
    expect(widgets[1].enabled).toBe(false);
  });
});
