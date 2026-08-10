import { DASHBOARD_WIDGET_IDS } from "@repo/shared";
import { useTranslation } from "react-i18next";
import { Label, Pie, PieChart } from "recharts";

import { useStudentDashboardSummary } from "~/api/queries/useStudentDashboardSummary";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "~/components/ui/chart";
import { cn } from "~/lib/utils";

import { DASHBOARD_WIDGET_HANDLES } from "../../../../../e2e/data/dashboard/handles";
import { DashboardWidgetQueryState } from "../components/DashboardWidgetQueryState";
import {
  DashboardWidgetCard,
  DashboardWidgetContent,
  DashboardWidgetFooter,
  DashboardWidgetHeader,
} from "../components/WidgetCard";
import { DASHBOARD_WIDGET_REGISTRY } from "../widgetRegistry";

import type { ChartConfig } from "~/components/ui/chart";

const STATUS_STYLES = [
  { key: "completed", color: "bg-success-500", fill: "var(--color-completed)" },
  { key: "inProgress", color: "bg-warning-500", fill: "var(--color-inProgress)" },
  { key: "notStarted", color: "bg-neutral-300", fill: "var(--color-notStarted)" },
] as const;

export function WidgetStudentCourseCompletion() {
  const { t } = useTranslation();
  const { data, isLoading, isError, refetch } = useStudentDashboardSummary();
  const metadata = DASHBOARD_WIDGET_REGISTRY[DASHBOARD_WIDGET_IDS.STUDENT_COURSE_COMPLETION];
  const completion = data?.completion;
  const chartConfig = {
    completed: {
      label: t("dashboardHome.widgets.studentTiles.courseCompletion.completed"),
      color: "var(--success-500)",
    },
    inProgress: {
      label: t("dashboardHome.widgets.studentTiles.courseCompletion.inProgress"),
      color: "var(--warning-500)",
    },
    notStarted: {
      label: t("dashboardHome.widgets.studentTiles.courseCompletion.notStarted"),
      color: "var(--neutral-300)",
    },
  } satisfies ChartConfig;
  const chartData = STATUS_STYLES.map(({ key, fill }) => ({
    status: key,
    value: completion?.[key] ?? 0,
    fill,
  }));

  return (
    <DashboardWidgetCard testId={DASHBOARD_WIDGET_HANDLES.STUDENT_COURSE_COMPLETION}>
      <DashboardWidgetHeader
        title={t(metadata.titleKey)}
        icon={metadata.icon}
        iconClassName={metadata.iconClassName}
        iconContainerClassName={metadata.iconContainerClassName}
      />
      <DashboardWidgetContent className="flex flex-col items-center justify-center">
        <DashboardWidgetQueryState
          isLoading={isLoading}
          isError={isError}
          onRetry={() => void refetch()}
        />
        {!isLoading && !isError && completion?.total === 0 && (
          <div className="flex flex-1 items-center justify-center text-center text-neutral-600">
            {t("dashboardHome.widgets.studentTiles.courseCompletion.empty")}
          </div>
        )}
        {completion && completion.total > 0 && (
          <>
            <span className="sr-only">{completion.percentage}%</span>
            <ChartContainer
              config={chartConfig}
              role="img"
              aria-label={t(
                "dashboardHome.widgets.studentTiles.courseCompletion.completedOfTotal",
                {
                  completed: completion.completed,
                  total: completion.total,
                },
              )}
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
                            {completion.percentage}%
                          </tspan>
                          <tspan
                            x={viewBox.cx}
                            y={(viewBox.cy ?? 0) + 16}
                            className="details fill-neutral-500"
                          >
                            {completion.completed}/{completion.total}
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
      {completion && completion.total > 0 && (
        <DashboardWidgetFooter>
          <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-sm text-neutral-500">
            {STATUS_STYLES.map(({ key, color }) => (
              <div key={key} className="flex items-center gap-1.5">
                <span className={cn("size-2 rounded-full", color)} />
                {t(`dashboardHome.widgets.studentTiles.courseCompletion.${key}`)}
              </div>
            ))}
          </div>
        </DashboardWidgetFooter>
      )}
    </DashboardWidgetCard>
  );
}
