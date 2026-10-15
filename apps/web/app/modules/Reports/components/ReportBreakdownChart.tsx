import { ChartColumnBig } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts";

import { ChartContainer, ChartTooltip } from "~/components/ui/chart";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { cn } from "~/lib/utils";

import { formatReportPercent } from "../reports.utils";

import type { RunReportResponse } from "~/api/generated-api";
import type { ChartConfig } from "~/components/ui/chart";

type Breakdowns = RunReportResponse["data"]["breakdowns"];
type BreakdownKind = keyof Breakdowns;

type ReportBreakdownChartProps = {
  breakdowns: Breakdowns;
  className?: string;
};

const BREAKDOWN_KINDS: BreakdownKind[] = ["courses", "groups", "paths"];
const MAX_BARS = 8;
const MIN_BAR_ROW_HEIGHT = 36;
const MAX_BAR_ROW_HEIGHT = 56;
const CHART_PADDING = 24;
const LABEL_MAX_LENGTH = 24;

const truncateLabel = (value: string) =>
  value.length > LABEL_MAX_LENGTH ? `${value.slice(0, LABEL_MAX_LENGTH - 1)}…` : value;

export function ReportBreakdownChart({ breakdowns, className }: ReportBreakdownChartProps) {
  const { t } = useTranslation();
  const availableKinds = BREAKDOWN_KINDS.filter((kind) => breakdowns[kind].length > 0);
  const [selectedKind, setSelectedKind] = useState<BreakdownKind>("courses");
  const activeKind = availableKinds.includes(selectedKind) ? selectedKind : availableKinds[0];
  const items = activeKind ? breakdowns[activeKind] : [];
  const chartData = items.slice(0, MAX_BARS).map((item) => ({
    ...item,
    completionRate: item.completionRate ?? 0,
    rateLabel: formatReportPercent(item.completionRate),
  }));
  const chartConfig = {
    completionRate: { label: t("reports.metrics.completionRate"), color: "var(--primary-600)" },
  } satisfies ChartConfig;

  return (
    <section
      className={cn(
        "flex h-full flex-col rounded-lg border border-neutral-200 bg-white p-5",
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="body-base-md flex items-center gap-2 text-neutral-950">
            <ChartColumnBig className="size-4 text-neutral-500" aria-hidden="true" />
            {t("reports.breakdowns.title")}
          </h3>
          <p className="details text-neutral-500">
            {items.length > MAX_BARS
              ? t("reports.breakdowns.showingTop", { shown: MAX_BARS, count: items.length })
              : t("reports.breakdowns.subtitle")}
          </p>
        </div>
        {availableKinds.length > 1 && (
          <Tabs
            value={activeKind}
            onValueChange={(value) => setSelectedKind(value as BreakdownKind)}
          >
            <TabsList className="h-9">
              {availableKinds.map((kind) => (
                <TabsTrigger key={kind} value={kind} className="px-3 py-1 text-xs">
                  {t(`reports.breakdowns.tabs.${kind}`)}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        )}
      </div>
      {chartData.length ? (
        <ChartContainer
          key={activeKind}
          config={chartConfig}
          className="mt-4 aspect-auto w-full flex-1"
          style={{
            minHeight: chartData.length * MIN_BAR_ROW_HEIGHT + CHART_PADDING,
            maxHeight: chartData.length * MAX_BAR_ROW_HEIGHT + CHART_PADDING,
          }}
          role="img"
          aria-label={t("reports.breakdowns.chartLabel", {
            breakdown: t(`reports.breakdowns.tabs.${activeKind}`),
          })}
        >
          <BarChart
            accessibilityLayer
            data={chartData}
            layout="vertical"
            margin={{ left: 0, right: 48, top: 0, bottom: 0 }}
            barCategoryGap={10}
          >
            <CartesianGrid horizontal={false} strokeDasharray="3 3" />
            <XAxis type="number" domain={[0, 100]} hide />
            <YAxis
              type="category"
              dataKey="label"
              width={168}
              axisLine={false}
              tickLine={false}
              tick={({ x, y, payload }) => (
                <text
                  x={x - 8}
                  y={y}
                  dy={4}
                  textAnchor="end"
                  fontSize={12}
                  className="fill-neutral-600"
                >
                  <title>{payload.value}</title>
                  {truncateLabel(String(payload.value))}
                </text>
              )}
            />
            <ChartTooltip
              cursor={{ fill: "var(--neutral-50)" }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const item = payload[0].payload as (typeof chartData)[number];
                return (
                  <div className="rounded-lg border border-neutral-200 bg-background px-3 py-2 shadow-sm">
                    <p className="body-sm-md text-neutral-950">{item.label}</p>
                    <p className="details text-neutral-700">
                      {t("reports.metrics.completionRate")}: {item.rateLabel}
                    </p>
                    <p className="details text-neutral-500">
                      {t("reports.breakdowns.learnersAndEnrollments", {
                        learners: item.learners,
                        enrollments: item.courseEnrollments,
                      })}
                    </p>
                  </div>
                );
              }}
            />
            <Bar
              dataKey="completionRate"
              fill="var(--color-completionRate)"
              radius={4}
              maxBarSize={18}
              background={{ fill: "var(--neutral-100)", radius: 4 }}
            >
              <LabelList
                dataKey="rateLabel"
                position="right"
                offset={8}
                className="fill-neutral-700"
                fontSize={12}
              />
            </Bar>
          </BarChart>
        </ChartContainer>
      ) : (
        <p className="body-sm flex flex-1 items-center justify-center py-10 text-neutral-500">
          {t("reports.results.noBreakdown")}
        </p>
      )}
    </section>
  );
}
