import { Link } from "@remix-run/react";
import { DASHBOARD_WIDGET_SIZES, DASHBOARD_WIDGET_TYPES } from "@repo/shared";
import { useTranslation } from "react-i18next";
import { Label, Pie, PieChart } from "recharts";

import { useDashboardTrainingCompletion } from "~/api/queries/useDashboardTrainingCompletion";
import { Button } from "~/components/ui/button";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "~/components/ui/chart";
import { cn } from "~/lib/utils";

import { DASHBOARD_WIDGET_HANDLES } from "../../../../../e2e/data/dashboard/handles";
import { DashboardWidgetQueryState } from "../components/DashboardWidgetQueryState";
import {
  DashboardWidgetCard,
  DashboardWidgetContent,
  DashboardWidgetHeader,
} from "../components/WidgetCard";
import { DASHBOARD_WIDGET_REGISTRY } from "../widgetRegistry";

import type { DashboardWidgetSize } from "../types";
import type { ChartConfig } from "~/components/ui/chart";

const STATUS_STYLES = [
  { key: "completed", fill: "var(--color-completed)" },
  { key: "inProgress", fill: "var(--color-inProgress)" },
  { key: "notStarted", fill: "var(--color-notStarted)" },
] as const;

export function WidgetAdminTrainingCompletion({
  widgetSize = DASHBOARD_WIDGET_SIZES.TWO_BY_TWO,
}: {
  widgetSize?: DashboardWidgetSize;
}) {
  const { t } = useTranslation();
  const { data: stats, isLoading, isError, refetch } = useDashboardTrainingCompletion();
  const total = stats?.total ?? 0;
  const percentage = stats?.percentage ?? 0;
  const isCompact = widgetSize === DASHBOARD_WIDGET_SIZES.ONE_BY_ONE;
  const metadata = DASHBOARD_WIDGET_REGISTRY[DASHBOARD_WIDGET_TYPES.TRAINING_COMPLETION];
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
    <DashboardWidgetCard
      className="relative !overflow-visible hover:z-10 focus-within:z-10"
      testId={DASHBOARD_WIDGET_HANDLES.ADMIN_TRAINING_COMPLETION}
    >
      <DashboardWidgetHeader
        title={t(metadata.titleKey)}
        icon={metadata.icon}
        dataScope={metadata.dataScope}
        iconClassName={metadata.iconClassName}
        iconContainerClassName={metadata.iconContainerClassName}
      />
      <DashboardWidgetContent className="flex min-h-0 flex-col items-center justify-center !overflow-visible p-0">
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
              className={cn(
                "aspect-square h-full max-h-64 w-auto max-w-full shrink-0",
                isCompact && "max-h-24",
              )}
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
                  innerRadius="55%"
                  outerRadius="94%"
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
                            y={(viewBox.cy ?? 0) + (isCompact ? 5 : -8)}
                            className={cn("fill-neutral-950", isCompact ? "body-base-md" : "h4")}
                          >
                            {percentage}%
                          </tspan>
                          {!isCompact && (
                            <tspan
                              x={viewBox.cx}
                              y={(viewBox.cy ?? 0) + 16}
                              className="details fill-neutral-500"
                            >
                              {stats?.completed}/{total}
                            </tspan>
                          )}
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
    </DashboardWidgetCard>
  );
}
