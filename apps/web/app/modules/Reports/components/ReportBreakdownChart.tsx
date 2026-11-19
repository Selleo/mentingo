import { ChartColumnBig } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts";

import { ChartContainer, ChartTooltip } from "~/components/ui/chart";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { cn } from "~/lib/utils";

import {
  BREAKDOWN_KINDS,
  BREAKDOWN_STATUS_COLORS,
  BREAKDOWN_STATUSES,
  MAX_BREAKDOWN_BARS,
} from "../constants/reportCharts.constants";
import { toBreakdownStatusBar } from "../utils/reportCharts.utils";
import { formatReportPercent } from "../utils/reports.utils";

import type { BreakdownKind, BreakdownStatusBar } from "../types/reportCharts.types";
import type { ReportResult } from "../types/reports-api.types";
import type { ChartConfig } from "~/components/ui/chart";

type ReportBreakdownChartProps = {
  breakdowns: ReportResult["breakdowns"];
  kinds?: BreakdownKind[];
  className?: string;
};

const MIN_BAR_ROW_HEIGHT = 36;
const MAX_BAR_ROW_HEIGHT = 56;
const CHART_PADDING = 24;
const LABEL_MAX_LENGTH = 24;

const truncateLabel = (value: string) =>
  value.length > LABEL_MAX_LENGTH ? `${value.slice(0, LABEL_MAX_LENGTH - 1)}…` : value;

export function ReportBreakdownChart({
  breakdowns,
  kinds = BREAKDOWN_KINDS,
  className,
}: ReportBreakdownChartProps) {
  const { t } = useTranslation();
  const availableKinds = kinds.filter((kind) => breakdowns[kind].length > 0);
  const [selectedKind, setSelectedKind] = useState<BreakdownKind>(kinds[0]);
  const activeKind = availableKinds.includes(selectedKind) ? selectedKind : availableKinds[0];
  const items = activeKind ? breakdowns[activeKind] : [];
  const chartData = items.slice(0, MAX_BREAKDOWN_BARS).map(toBreakdownStatusBar);
  const chartConfig = Object.fromEntries(
    Object.values(BREAKDOWN_STATUSES).map((status) => [
      status,
      { label: t(`reports.values.${status}`), color: BREAKDOWN_STATUS_COLORS[status] },
    ]),
  ) satisfies ChartConfig;

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
            {t("reports.breakdowns.statusTitle")}
          </h3>
          <p className="details text-neutral-500">
            {items.length > MAX_BREAKDOWN_BARS
              ? t("reports.breakdowns.showingTop", {
                  shown: MAX_BREAKDOWN_BARS,
                  count: items.length,
                })
              : t("reports.breakdowns.statusSubtitle")}
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
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
        {Object.values(BREAKDOWN_STATUSES).map((status) => (
          <li key={status} className="details flex items-center gap-1.5 text-neutral-600">
            <span
              className="size-2.5 rounded-sm"
              style={{ backgroundColor: BREAKDOWN_STATUS_COLORS[status] }}
              aria-hidden="true"
            />
            {t(`reports.values.${status}`)}
          </li>
        ))}
      </ul>
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
          aria-label={t("reports.breakdowns.statusChartLabel", {
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
                const bar = payload[0].payload as BreakdownStatusBar;
                return (
                  <div className="rounded-lg border border-neutral-200 bg-background px-3 py-2 shadow-sm">
                    <p className="body-sm-md text-neutral-950">{bar.label}</p>
                    {Object.values(BREAKDOWN_STATUSES).map((status) => (
                      <p key={status} className="details text-neutral-700">
                        {t(`reports.values.${status}`)}: {formatReportPercent(bar[status])}
                      </p>
                    ))}
                    <p className="details text-neutral-500">
                      {t("reports.breakdowns.learnersAndEnrollments", {
                        learners: bar.learners,
                        enrollments: bar.courseEnrollments,
                      })}
                    </p>
                  </div>
                );
              }}
            />
            {Object.values(BREAKDOWN_STATUSES).map((status, index, statuses) => (
              <Bar
                key={status}
                dataKey={status}
                stackId="status"
                fill={`var(--color-${status})`}
                maxBarSize={18}
                radius={index === statuses.length - 1 ? [0, 4, 4, 0] : 0}
              >
                {index === statuses.length - 1 && (
                  <LabelList
                    dataKey="completionLabel"
                    position="right"
                    offset={8}
                    className="fill-neutral-700"
                    fontSize={12}
                  />
                )}
              </Bar>
            ))}
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
