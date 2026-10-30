import { FileInput, MousePointerClick } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Label, Pie, PieChart } from "recharts";

import { Card, CardContent } from "~/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "~/components/ui/chart";
import { cn } from "~/lib/utils";
import { formatLocalizedDate } from "~/utils/formatLocalizedDate";

import { PHISHING_ACTIVITY_COLORS, PHISHING_NO_ACTION_FILL } from "./phishingReport.styles";
import { ACTIVITY_TYPES, OUTCOMES, countOutcomes, percentOf } from "./phishingReport.utils";

import type { Outcome, PhishingActivity, PhishingTotals } from "./phishingReport.utils";
import type { ChartConfig } from "~/components/ui/chart";

const OUTCOME_STYLES = [
  { key: OUTCOMES.SUBMITTED, color: PHISHING_ACTIVITY_COLORS.submitted.fill },
  { key: OUTCOMES.CLICKED_ONLY, color: PHISHING_ACTIVITY_COLORS.clicked.fill },
  { key: OUTCOMES.NO_ACTION, color: PHISHING_NO_ACTION_FILL },
] as const;

const ACTIVITY_STYLES = {
  [ACTIVITY_TYPES.CLICKED]: {
    Icon: MousePointerClick,
    className: PHISHING_ACTIVITY_COLORS.clicked.icon,
  },
  [ACTIVITY_TYPES.SUBMITTED]: {
    Icon: FileInput,
    className: PHISHING_ACTIVITY_COLORS.submitted.icon,
  },
};

export function PhishingOverview({
  totals,
  tracksSubmissions,
}: {
  totals: PhishingTotals;
  tracksSubmissions: boolean;
}) {
  const { t } = useTranslation();
  const outcomes = OUTCOME_STYLES.filter(
    ({ key }) => tracksSubmissions || key !== OUTCOMES.SUBMITTED,
  );
  // Without submissions every risky person only clicked, so "only" adds nothing.
  const outcomeLabel = (key: Outcome) =>
    key === OUTCOMES.CLICKED_ONLY && !tracksSubmissions
      ? t("phishing.metrics.clicked")
      : t(`phishing.outcomes.${key}`);
  const counts = countOutcomes(totals);
  const chartConfig = Object.fromEntries(
    outcomes.map(({ key, color }) => [key, { label: outcomeLabel(key), color }]),
  ) satisfies ChartConfig;
  const chartData = totals.recipients
    ? outcomes.map(({ key }) => ({
        outcome: key,
        value: counts[key],
        fill: `var(--color-${key})`,
      }))
    : [{ outcome: OUTCOMES.NO_ACTION, value: 1, fill: `var(--color-${OUTCOMES.NO_ACTION})` }];

  return (
    <Card className="rounded-xl shadow-sm lg:col-span-2">
      <CardContent className="flex h-full flex-col gap-4 p-6">
        <h5 className="h6 text-neutral-950">{t("phishing.outcomes.title")}</h5>
        <div className="flex flex-1 flex-col items-center gap-6 sm:flex-row sm:gap-10">
          <ChartContainer
            config={chartConfig}
            role="img"
            aria-label={`${t("phishing.metrics.riskRate")}: ${totals.riskRate}%`}
            className="aspect-square h-44 shrink-0"
          >
            <PieChart accessibilityLayer>
              {totals.recipients > 0 && (
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent hideLabel nameKey="outcome" />}
                />
              )}
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="outcome"
                innerRadius="68%"
                outerRadius="100%"
                stroke="var(--background)"
                strokeWidth={3}
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
                          {totals.riskRate}%
                        </tspan>
                        <tspan
                          x={viewBox.cx}
                          y={(viewBox.cy ?? 0) + 16}
                          className="details fill-neutral-500"
                        >
                          {t("phishing.metrics.riskRate")}
                        </tspan>
                      </text>
                    );
                  }}
                />
              </Pie>
            </PieChart>
          </ChartContainer>
          <ul className="flex w-full flex-col divide-y divide-neutral-100">
            {outcomes.map(({ key, color }) => (
              <li key={key} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <span className="flex-1 text-sm text-neutral-800">{outcomeLabel(key)}</span>
                <strong className="text-sm font-semibold tabular-nums text-neutral-950">
                  {counts[key]}
                </strong>
                <span className="w-10 text-right text-sm tabular-nums text-neutral-500">
                  {percentOf(counts[key], totals.recipients)}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

export function PhishingActivityFeed({ activity }: { activity: PhishingActivity[] }) {
  const { t, i18n } = useTranslation();

  return (
    <Card className="rounded-xl shadow-sm">
      <CardContent className="flex h-full flex-col gap-4 p-6">
        <h5 className="h6 text-neutral-950">{t("phishing.recentActivity")}</h5>
        {activity.length ? (
          <ol className="-mr-2 flex max-h-64 flex-col divide-y divide-neutral-100 overflow-y-auto pr-2">
            {activity.map(({ userId, firstName, lastName, action, at }) => {
              const { Icon, className } = ACTIVITY_STYLES[action];
              return (
                <li
                  key={`${userId}-${action}`}
                  className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <span
                    className={cn("flex size-5 shrink-0 items-center justify-center", className)}
                  >
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium text-neutral-950">
                      {firstName} {lastName}
                    </span>
                    <span className="text-xs text-neutral-600">
                      {t(`phishing.activity.${action}`)}
                    </span>
                  </div>
                  <time dateTime={at} className="shrink-0 text-xs tabular-nums text-neutral-500">
                    {formatLocalizedDate(i18n.language, at, "dd MMM, HH:mm")}
                  </time>
                </li>
              );
            })}
          </ol>
        ) : (
          <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed bg-neutral-50 px-4 py-8 text-center text-sm text-muted-foreground">
            {t("phishing.activityEmpty")}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
