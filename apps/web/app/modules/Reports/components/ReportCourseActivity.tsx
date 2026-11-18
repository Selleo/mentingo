import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts";

import { Button } from "~/components/ui/button";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "~/components/ui/chart";
import { Input } from "~/components/ui/input";

import type { RunReportResponse } from "~/api/generated-api";

type CourseActivity = NonNullable<RunReportResponse["data"]["courseActivity"]>;
type ReportCourseActivityProps = {
  period: { from: string; to: string };
  onPeriodChange: (period: { from: string; to: string }) => void;
  data?: CourseActivity;
  isFetching?: boolean;
};

function ActivityChart({
  items,
  kind,
}: {
  items: CourseActivity["popular"];
  kind: "popular" | "inactive";
}) {
  const { t } = useTranslation();
  const metricLabel = t(`reports.activity.${kind === "popular" ? "learners" : "days"}`);
  const neverActive = kind === "inactive" ? items.filter((item) => item.inactiveDays === null) : [];
  const chartData = items
    .filter((item) => kind === "popular" || item.inactiveDays !== null)
    .map((item) => ({
      ...item,
      value: kind === "popular" ? item.activeLearners : item.inactiveDays,
    }));
  return (
    <section className="min-w-0 rounded-lg border border-neutral-200 bg-white p-5">
      <h3 className="body-base-md text-neutral-950">{t(`reports.activity.${kind}`)}</h3>
      <p className="details text-neutral-500">{metricLabel}</p>
      {neverActive.length > 0 && (
        <div className="body-sm mt-3 rounded-lg bg-neutral-50 p-3">
          <p className="font-medium">{t("reports.activity.never")}</p>
          <ul className="list-inside list-disc">
            {neverActive.map((item) => (
              <li key={item.id}>{item.label}</li>
            ))}
          </ul>
        </div>
      )}
      {chartData.length > 0 && (
        <ChartContainer
          config={{ value: { label: metricLabel, color: "var(--primary-600)" } }}
          className="mt-4 aspect-auto w-full"
          style={{ height: chartData.length * 40 + 24 }}
          role="img"
          aria-label={`${t(`reports.activity.${kind}`)}: ${metricLabel}`}
        >
          <BarChart
            accessibilityLayer
            data={chartData}
            layout="vertical"
            margin={{ left: 0, right: 40 }}
          >
            <CartesianGrid horizontal={false} strokeDasharray="3 3" />
            <XAxis type="number" allowDecimals={false} hide />
            <YAxis
              type="category"
              dataKey="label"
              width={140}
              axisLine={false}
              tickLine={false}
              tickFormatter={(label: string) =>
                label.length > 22 ? `${label.slice(0, 21)}…` : label
              }
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="value" fill="var(--color-value)" radius={4} maxBarSize={18}>
              <LabelList
                dataKey="value"
                position="right"
                className="fill-neutral-700"
                fontSize={12}
              />
            </Bar>
          </BarChart>
        </ChartContainer>
      )}
      {items.length === 0 && (
        <p className="body-sm py-10 text-neutral-500">{t("reports.activity.empty")}</p>
      )}
      <ul className="sr-only">
        {chartData.map((item) => (
          <li key={item.id}>
            {item.label}: {item.value} {metricLabel}; {item.lastActivityAt}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ReportCourseActivity({
  period,
  onPeriodChange,
  data,
  isFetching,
}: ReportCourseActivityProps) {
  const { t } = useTranslation();
  const [draftPeriod, setDraftPeriod] = useState(period);
  const validPeriod = Boolean(
    draftPeriod.from && draftPeriod.to && draftPeriod.from <= draftPeriod.to,
  );
  return (
    <section className="space-y-3" aria-busy={isFetching}>
      <h2 className="h6 text-neutral-950">{t("reports.activity.title")}</h2>
      <p className="body-sm text-neutral-600">{t("reports.activity.definition")}</p>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (validPeriod) onPeriodChange(draftPeriod);
        }}
      >
        <label className="details flex w-44 max-w-full flex-col gap-1">
          {t("reports.activity.from")}
          <Input
            type="date"
            className="[&::-webkit-calendar-picker-indicator]:!static [&::-webkit-datetime-edit-fields-wrapper]:!left-0 [&::-webkit-datetime-edit]:!left-0"
            required
            value={draftPeriod.from}
            max={draftPeriod.to}
            onChange={(event) =>
              setDraftPeriod((current) => ({ ...current, from: event.target.value }))
            }
          />
        </label>
        <label className="details flex w-44 max-w-full flex-col gap-1">
          {t("reports.activity.to")}
          <Input
            type="date"
            className="[&::-webkit-calendar-picker-indicator]:!static [&::-webkit-datetime-edit-fields-wrapper]:!left-0 [&::-webkit-datetime-edit]:!left-0"
            required
            value={draftPeriod.to}
            min={draftPeriod.from}
            onChange={(event) =>
              setDraftPeriod((current) => ({ ...current, to: event.target.value }))
            }
          />
        </label>
        <Button type="submit" variant="outline" disabled={!validPeriod || isFetching}>
          {t("reports.activity.apply")}
        </Button>
      </form>
      <p className="details text-neutral-500">{t("reports.activity.period", period)}</p>
      <p className="details text-neutral-500">{t("reports.activity.limitation")}</p>
      <div className="grid gap-4 lg:grid-cols-2">
        <ActivityChart kind="popular" items={data?.popular ?? []} />
        <ActivityChart kind="inactive" items={data?.inactive ?? []} />
      </div>
    </section>
  );
}
