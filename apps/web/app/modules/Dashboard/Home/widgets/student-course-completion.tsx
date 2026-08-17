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

export function WidgetStudentCourseCompletion({
  widgetSize = "1x1",
}: {
  widgetSize?: DashboardWidgetSize;
}) {
  const { t } = useTranslation();
  const { data, isLoading, isError, refetch } = useStudentDashboardSummary();
  const metadata = DASHBOARD_WIDGET_REGISTRY[DASHBOARD_WIDGET_IDS.STUDENT_COURSE_COMPLETION];
  const completion = data?.completion;
  const isCompact = widgetSize === "1x1";
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
    <DashboardWidgetCard
      className="relative !overflow-visible hover:z-10 focus-within:z-10"
      testId={DASHBOARD_WIDGET_HANDLES.STUDENT_COURSE_COMPLETION}
    >
      <DashboardWidgetHeader
        title={t(metadata.titleKey)}
        icon={metadata.icon}
        iconClassName={metadata.iconClassName}
        iconContainerClassName={metadata.iconContainerClassName}
      />
      <DashboardWidgetContent className="flex min-h-0 flex-col items-center justify-center !overflow-visible p-0">
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
                            {completion.percentage}%
                          </tspan>
                          {!isCompact && (
                            <tspan
                              x={viewBox.cx}
                              y={(viewBox.cy ?? 0) + 16}
                              className="details fill-neutral-500"
                            >
                              {completion.completed}/{completion.total}
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
