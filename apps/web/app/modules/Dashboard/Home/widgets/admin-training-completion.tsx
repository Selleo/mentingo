import { Link } from "@remix-run/react";
import { DASHBOARD_WIDGET_IDS } from "@repo/shared";
import { useTranslation } from "react-i18next";
import { Label, Pie, PieChart } from "recharts";

import { useDashboardTrainingCompletion } from "~/api/queries/useDashboardTrainingCompletion";
import { Button } from "~/components/ui/button";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "~/components/ui/chart";
import { cn } from "~/lib/utils";

import { DashboardWidgetQueryState } from "../components/DashboardWidgetQueryState";
import {
  DashboardWidgetCard,
  DashboardWidgetContent,
  DashboardWidgetFooter,
  DashboardWidgetHeader,
} from "../components/WidgetCard";
import { DASHBOARD_WIDGET_REGISTRY } from "../widgetRegistry";

import { DASHBOARD_WIDGET_HANDLES } from "../../../../../e2e/data/dashboard/handles";

import type { ChartConfig } from "~/components/ui/chart";

const STATUS_STYLES = [
  { key: "completed", color: "bg-success-500", fill: "var(--color-completed)" },
  { key: "inProgress", color: "bg-warning-500", fill: "var(--color-inProgress)" },
  { key: "notStarted", color: "bg-neutral-300", fill: "var(--color-notStarted)" },
] as const;

export function WidgetAdminTrainingCompletion() {
  const { t } = useTranslation();
  const { data: stats, isLoading, isError, refetch } = useDashboardTrainingCompletion();
  const total = stats?.total ?? 0;
  const percentage = stats?.percentage ?? 0;
  const metadata = DASHBOARD_WIDGET_REGISTRY[DASHBOARD_WIDGET_IDS.ADMIN_TRAINING_COMPLETION];
  const chartConfig = {
    completed: {
      label: t("dashboardHome.widgets.training_completion.completed"),
      color: "var(--success-500)",
    },
    inProgress: {
      label: t("dashboardHome.widgets.training_completion.inProgress"),
      color: "var(--warning-500)",
    },
    notStarted: {
      label: t("dashboardHome.widgets.training_completion.notStarted"),
      color: "var(--neutral-300)",
    },
  } satisfies ChartConfig;
  const chartData = STATUS_STYLES.map(({ key, fill }) => ({
    status: key,
    value: stats?.[key] ?? 0,
    fill,
  }));

  return (
    <DashboardWidgetCard testId={DASHBOARD_WIDGET_HANDLES.ADMIN_TRAINING_COMPLETION}>
      <DashboardWidgetHeader
        title={t(metadata.titleKey)}
        icon={metadata.icon}
        iconClassName={metadata.iconClassName}
        iconContainerClassName={metadata.iconContainerClassName}
      />
      <DashboardWidgetContent className="flex flex-col items-center justify-center gap-6">
        {isLoading || isError ? (
          <DashboardWidgetQueryState
            isLoading={isLoading}
            isError={isError}
            onRetry={() => void refetch()}
          />
        ) : total === 0 ? (
          <div className="flex flex-1 flex-col items-start justify-center gap-3">
            <p className="text-neutral-600">
              {t("dashboardHome.widgets.training_completion.empty")}
            </p>
            <Button asChild size="sm">
              <Link to="/admin/courses">
                {t("dashboardHome.widgets.training_completion.assignCourses")}
              </Link>
            </Button>
          </div>
        ) : (
          <>
            <ChartContainer
              config={chartConfig}
              role="img"
              aria-label={t("dashboardHome.widgets.trainingCompletionChartLabel", {
                completed: stats?.completed ?? 0,
                total,
                percentage,
              })}
              className="aspect-square size-48 shrink-0"
            >
              <PieChart accessibilityLayer>
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent hideLabel nameKey="status" />}
                />
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="status"
                  innerRadius={50}
                  outerRadius={90}
                  stroke="var(--background)"
                  strokeWidth={4}
                  startAngle={90}
                  endAngle={-270}
                >
                  <Label
                    content={({ viewBox }) => {
                      if (!viewBox || !("cx" in viewBox) || !("cy" in viewBox)) return null;

                      return (
                        <text
                          x={viewBox.cx}
                          y={viewBox.cy}
                          textAnchor="middle"
                          dominantBaseline="middle"
                        >
                          <tspan
                            x={viewBox.cx}
                            y={(viewBox.cy ?? 0) - 8}
                            className="h4 fill-neutral-950"
                          >
                            {percentage}%
                          </tspan>
                          <tspan
                            x={viewBox.cx}
                            y={(viewBox.cy ?? 0) + 16}
                            className="details fill-neutral-500"
                          >
                            {stats?.completed}/{total}
                          </tspan>
                        </text>
                      );
                    }}
                  />
                </Pie>
              </PieChart>
            </ChartContainer>
          </>
        )}
      </DashboardWidgetContent>
      <DashboardWidgetFooter>
        <div className="flex justify-between flex-wrap gap-x-3 gap-y-1 text-sm text-neutral-500">
          {STATUS_STYLES.map(({ key, color }) => (
            <div key={key} className="flex items-center gap-1.5">
              <span className={cn("size-2 rounded-full bg-success-500", color)} />
              {t(`dashboardHome.widgets.training_completion.${key}`)}
            </div>
          ))}
        </div>
      </DashboardWidgetFooter>
    </DashboardWidgetCard>
  );
}
