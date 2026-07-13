import { DASHBOARD_WIDGET_IDS } from "./dashboard.types";
import TrainingCompletionWidget from "./widgets/admin/TrainingCompletionWidget";
import ContinueLearningWIdget from "./widgets/student/ContinueLearningWidget";

import type { DashboardWidgetLayout, DashboardWidgetId } from "./dashboard.types";
import type { ComponentType } from "react";

type DashboardGridProps = {
  widgets: DashboardWidgetLayout[];
};

const WIDGET_COMPONENTS: Partial<Record<DashboardWidgetId, ComponentType>> = {
  [DASHBOARD_WIDGET_IDS.TRAINING_COMPLETION]: TrainingCompletionWidget,
  [DASHBOARD_WIDGET_IDS.CONTINUE_LEARNING]: ContinueLearningWIdget,
};

export default function DashboardGrid({ widgets }: DashboardGridProps) {
  const visibleWidgets = widgets
    .filter((widget) => widget.enabled)
    .sort((first, second) => first.order - second.order);

  return (
    <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {visibleWidgets.map((widget) => {
        const WidgetComponent = WIDGET_COMPONENTS[widget.widgetId];

        if (!WidgetComponent) {
          return null;
        }

        return (
          <div key={widget.widgetId} className="min-h-56 rounded-lg bg-white p-4 drop-shadow-card">
            <WidgetComponent />
          </div>
        );
      })}
    </section>
  );
}
