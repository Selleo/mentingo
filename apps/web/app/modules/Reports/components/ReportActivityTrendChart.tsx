import { Activity } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";

import { Badge } from "~/components/ui/badge";
import { ChartContainer, ChartTooltip } from "~/components/ui/chart";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import { ACTIVITY_TREND_CHART_HEIGHT } from "../constants/reportCharts.constants";
import { getActivityTrendChange } from "../utils/reportCharts.utils";

import type { ReportLearningInsights } from "../types/reportCharts.types";

type ReportActivityTrendChartProps = {
  trend: ReportLearningInsights["activityTrend"];
};

const formatMonth = (month: string, language: string, monthStyle: "short" | "long") =>
  new Intl.DateTimeFormat(language, { month: monthStyle, year: "numeric", timeZone: "UTC" }).format(
    new Date(`${month}-01T00:00:00Z`),
  );

export function ReportActivityTrendChart({ trend }: ReportActivityTrendChartProps) {
  const { t } = useTranslation();
  const language = useLanguageStore((state) => state.language);
  const change = getActivityTrendChange(trend);
  const metricLabel = t("reports.insights.activityTrendSubtitle");

  return (
    <section className="flex min-w-0 flex-col rounded-lg border border-neutral-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="body-base-md flex items-center gap-2 text-neutral-950">
            <Activity className="size-4 text-neutral-500" aria-hidden="true" />
            {t("reports.insights.activityTrend")}
          </h3>
          <p className="details text-neutral-500">{metricLabel}</p>
        </div>
        {change !== null && (
          <Badge variant={change >= 0 ? "successFilled" : "secondary"} className="w-max">
            {t("reports.insights.changeVsPreviousMonth", {
              change: `${change > 0 ? "+" : ""}${change}%`,
            })}
          </Badge>
        )}
      </div>
      <ChartContainer
        config={{ activeLearners: { label: metricLabel, color: "var(--primary-600)" } }}
        className="mt-4 aspect-auto w-full"
        style={{ height: ACTIVITY_TREND_CHART_HEIGHT }}
        role="img"
        aria-label={t("reports.insights.activityTrend")}
      >
        <BarChart accessibilityLayer data={trend} margin={{ left: 0, right: 0, top: 8 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis
            dataKey="month"
            axisLine={false}
            tickLine={false}
            fontSize={12}
            tickFormatter={(month: string) => formatMonth(month, language, "short").split(" ")[0]}
          />
          <ChartTooltip
            cursor={{ fill: "var(--neutral-50)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const point = payload[0].payload as ReportLearningInsights["activityTrend"][number];
              return (
                <div className="rounded-lg border border-neutral-200 bg-background px-3 py-2 shadow-sm">
                  <p className="body-sm-md text-neutral-950">
                    {formatMonth(point.month, language, "long")}
                  </p>
                  <p className="details text-neutral-700">
                    {t("reports.activity.tooltip.learners", { count: point.activeLearners })}
                  </p>
                </div>
              );
            }}
          />
          <Bar dataKey="activeLearners" fill="var(--color-activeLearners)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ChartContainer>
    </section>
  );
}
