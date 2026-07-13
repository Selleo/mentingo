import { useTranslation } from "react-i18next";

import { Checkbox } from "~/components/ui/checkbox";

import { isImplementedDashboardWidget } from "./dashboard.types";

import type { DashboardWidgetLayout, DashboardWidgetId } from "./dashboard.types";

type DashboardWidgetPickerProps = {
  widgets: DashboardWidgetLayout[];
  onWidgetEnabledChange: (widgetId: DashboardWidgetId, enabled: boolean) => void;
};

const WIDGET_LABEL_KEYS: Partial<Record<DashboardWidgetId, string>> = {
  "training-completion": "dashboardView.widgets.trainingCompletion",
  "deadline-risks": "dashboardView.widgets.deadlineRisks",
  "incomplete-courses": "dashboardView.widgets.incompleteCourses",
  "event-calendar": "dashboardView.widgets.eventCalendar",
  "continue-learning": "dashboardView.widgets.continueLearning",
};

export function DashboardWidgetPicker({
  widgets,
  onWidgetEnabledChange,
}: DashboardWidgetPickerProps) {
  const { t } = useTranslation();
  const availableWidgets = [...widgets]
    .filter(({ widgetId }) => isImplementedDashboardWidget(widgetId))
    .sort((first, second) => first.order - second.order);

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-4">
      <h2 className="body-lg-md text-neutral-950">{t("dashboardView.widgetPicker.title")}</h2>

      <p className="mt-1 text-sm text-neutral-700">{t("dashboardView.widgetPicker.description")}</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {availableWidgets.map((widget) => {
          const checkboxId = `dashboard-widget-${widget.widgetId}`;
          const labelKey = WIDGET_LABEL_KEYS[widget.widgetId];

          if (!labelKey) {
            return null;
          }

          return (
            <label
              key={widget.widgetId}
              htmlFor={checkboxId}
              className="flex cursor-pointer items-center gap-3 rounded-md border border-neutral-200 px-3 py-3 hover:bg-neutral-50"
            >
              <Checkbox
                id={checkboxId}
                checked={widget.enabled}
                onCheckedChange={(checked) => {
                  onWidgetEnabledChange(widget.widgetId, checked === true);
                }}
              />

              <span className="text-sm font-medium text-neutral-950">{t(labelKey)}</span>
            </label>
          );
        })}
      </div>
    </section>
  );
}
