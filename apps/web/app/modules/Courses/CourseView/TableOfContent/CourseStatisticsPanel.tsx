import { Clock, Users } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Label,
  LabelList,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ChartContainer, ChartTooltip, ChartTooltipContent } from "~/components/ui/chart";
import { useMediaQuery } from "~/hooks/useMediaQuery";
import { formatDuration } from "~/modules/Courses/utils/formatDuration";

import type { ProgressStatus } from "../lessonTypes";
import type { GetCourseStatisticsResponse } from "~/api/generated-api";
import type { ChartConfig } from "~/components/ui/chart";

type CourseStatisticsPanelProps = {
  courseStatistics?: GetCourseStatisticsResponse["data"];
  isLoading: boolean;
};

const courseStatusDistributionItems: Array<{
  fill: string;
  labelKey: string;
  status: ProgressStatus;
}> = [
  {
    fill: "var(--success-500)",
    labelKey: "progressBadge.completed",
    status: "completed",
  },
  {
    fill: "var(--warning-500)",
    labelKey: "progressBadge.inProgress",
    status: "in_progress",
  },
  {
    fill: "var(--neutral-300)",
    labelKey: "progressBadge.notStarted",
    status: "not_started",
  },
  {
    fill: "var(--error-500)",
    labelKey: "progressBadge.blocked",
    status: "blocked",
  },
];

export default function CourseStatisticsPanel({
  courseStatistics,
  isLoading,
}: CourseStatisticsPanelProps) {
  const { t } = useTranslation();
  const isTablet = useMediaQuery({ minWidth: 768 });
  const averageCompletionPercentage = Math.round(
    courseStatistics?.averageCompletionPercentage ?? 0,
  );
  const completionPercentage = Math.round(courseStatistics?.completionPercentage ?? 0);

  const courseStatusCounts = useMemo(
    () =>
      (courseStatistics?.courseStatusDistribution ?? []).reduce(
        (acc, item) => ({
          ...acc,
          [item.status]: item.count,
        }),
        {} as Partial<Record<ProgressStatus, number>>,
      ),
    [courseStatistics?.courseStatusDistribution],
  );

  const courseStatusDistributionChartData = useMemo(
    () =>
      courseStatusDistributionItems.map(({ fill, labelKey, status }) => ({
        count: courseStatusCounts[status] ?? 0,
        fill,
        status: t(labelKey),
      })),
    [courseStatusCounts, t],
  );
  const hasCourseStatusDistributionData = courseStatusDistributionChartData.some(
    ({ count }) => count > 0,
  );
  const averageCompletionRateChartConfig = useMemo(
    () =>
      ({
        completed: {
          label: t("adminCourseView.statistics.overview.averageCompletionPercentage"),
          color: "var(--success-500)",
        },
        remaining: {
          label: t("modernCourseView.stats.remaining"),
          color: "var(--neutral-200)",
        },
      }) satisfies ChartConfig,
    [t],
  );
  const averageCompletionRateChartData = useMemo(
    () => [
      {
        fill: "var(--success-500)",
        percentage: averageCompletionPercentage,
        state: "completed",
      },
      {
        fill: "var(--neutral-200)",
        percentage: Math.max(0, 100 - averageCompletionPercentage),
        state: "remaining",
      },
    ],
    [averageCompletionPercentage],
  );
  const isAverageCompletionRateChartEmpty = (courseStatistics?.enrolledCount ?? 0) === 0;
  const completionRateChartConfig = useMemo(
    () =>
      ({
        completed: {
          label: t("modernCourseView.contents.completionRate"),
          color: "var(--primary-700)",
        },
        remaining: {
          label: t("modernCourseView.stats.remaining"),
          color: "var(--neutral-200)",
        },
      }) satisfies ChartConfig,
    [t],
  );

  const completionRateChartData = useMemo(
    () => [
      {
        fill: "var(--primary-700)",
        percentage: completionPercentage,
        state: "completed",
      },
      {
        fill: "var(--neutral-200)",
        percentage: Math.max(0, 100 - completionPercentage),
        state: "remaining",
      },
    ],
    [completionPercentage],
  );
  const isCompletionRateChartEmpty = (courseStatistics?.enrolledCount ?? 0) === 0;

  const getPieChartLabel = (isEmpty: boolean, percentage: number) => {
    if (isLoading) {
      return "—";
    }

    if (isEmpty) {
      return t("adminStatisticsView.other.noData");
    }

    return `${percentage}%`;
  };

  return (
    <div className="space-y-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="font-gothic text-xl font-bold text-neutral-950">
            {t("modernCourseView.contents.courseStatistics")}
          </h3>
          <p className="mt-1 text-sm text-neutral-800">
            {t("modernCourseView.contents.statisticsDescription")}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <div className="flex min-h-32 items-center justify-center rounded-xl border border-primary-100 bg-gradient-to-br from-primary-50 to-white p-4 text-center shadow-sm">
            <div className="flex items-center justify-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-primary-100 ring-2 ring-primary-100/50">
                <Users className="size-5 text-primary-700" />
              </div>
              <div>
                <p className="text-2xl font-bold text-neutral-950">
                  {isLoading ? "—" : (courseStatistics?.enrolledCount ?? 0).toLocaleString()}
                </p>
                <p className="mt-0.5 text-xs font-semibold uppercase tracking-wide text-neutral-800">
                  {t("modernCourseView.contents.totalStudents")}
                </p>
              </div>
            </div>
          </div>

          <div className="flex min-h-32 items-center justify-center rounded-xl border border-amethyst-100 bg-gradient-to-br from-amethyst-50 to-white p-4 text-center shadow-sm">
            <div className="flex items-center justify-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-amethyst-200 ring-2 ring-amethyst-400">
                <Clock className="size-5 text-amethyst-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-neutral-950">
                  {isLoading ? "—" : formatDuration(courseStatistics?.averageSeconds ?? 0, t)}
                </p>
                <p className="mt-0.5 text-xs font-semibold uppercase tracking-wide text-neutral-800">
                  {t("modernCourseView.contents.averageTime")}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex w-full flex-col gap-4 rounded-xl border border-primary-100 bg-gradient-to-br from-primary-50 to-white p-5 shadow-sm drop-shadow-card lg:col-span-3">
          <hgroup>
            <h2 className="body-lg-md text-center text-neutral-950">
              {t("adminCourseView.statistics.overview.courseStatusDistribution")}
            </h2>
            <p className="body-sm-md text-center text-neutral-800">
              {t("adminCourseView.statistics.overview.courseStatusDistributionTooltip")}
            </p>
          </hgroup>

          {isLoading || !hasCourseStatusDistributionData ? (
            <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-neutral-200 bg-neutral-50 text-sm text-neutral-500">
              {isLoading ? "—" : t("enrollmentChartView.other.noData")}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={256}>
              <BarChart
                accessibilityLayer
                data={courseStatusDistributionChartData}
                layout="vertical"
                margin={{
                  left: -28,
                }}
                barCategoryGap="16.5"
              >
                <XAxis
                  type="number"
                  dataKey="count"
                  axisLine={false}
                  tickSize={0}
                  allowDecimals={false}
                />
                <YAxis
                  dataKey="status"
                  type="category"
                  tickLine={false}
                  tickMargin={10}
                  width={isTablet ? 168 : 0}
                  axisLine={false}
                />
                <CartesianGrid
                  stroke="var(--neutral-200)"
                  strokeDasharray="1 0"
                  horizontal={false}
                />
                <RechartsTooltip cursor={false} />
                <Bar dataKey="count">
                  <LabelList
                    dataKey="count"
                    position="insideLeft"
                    offset={isTablet ? 8 : 36}
                    className="fill-white"
                    fontSize={12}
                  />
                  {courseStatusDistributionChartData.map((entry) => (
                    <Cell key={entry.status} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}

          <div className="flex flex-col gap-2 md:sr-only">
            {courseStatusDistributionChartData.map(({ fill, status }) => (
              <div key={status} className="flex items-center gap-2 text-sm text-neutral-700">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: fill }} />
                <span>{status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-success-100 bg-gradient-to-br from-success-50 to-white p-6 shadow-sm drop-shadow-card">
          <h4 className="body-lg-md text-center text-neutral-950">
            {t("adminCourseView.statistics.overview.averageCompletionPercentage")}
          </h4>
          <p className="body-sm-md text-center text-neutral-800">
            {t("adminCourseView.statistics.overview.averageCompletionPercentageTooltip")}
          </p>

          <ChartContainer
            config={averageCompletionRateChartConfig}
            className="mx-auto aspect-square size-full max-h-[250px]"
          >
            <PieChart>
              {!isAverageCompletionRateChartEmpty && (
                <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
              )}
              <Pie
                data={averageCompletionRateChartData}
                dataKey="percentage"
                nameKey="state"
                innerRadius={84}
                strokeWidth={5}
                startAngle={90}
                endAngle={-270}
              >
                <Label
                  content={({ viewBox }) => {
                    if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                      return (
                        <text
                          x={viewBox.cx}
                          y={viewBox.cy}
                          textAnchor="middle"
                          dominantBaseline="middle"
                        >
                          <tspan x={viewBox.cx} y={viewBox.cy} className="h3 fill-primary-950">
                            {getPieChartLabel(
                              isAverageCompletionRateChartEmpty,
                              averageCompletionPercentage,
                            )}
                          </tspan>
                        </text>
                      );
                    }
                  }}
                />
              </Pie>
            </PieChart>
          </ChartContainer>

          <div className="flex flex-col items-center justify-center gap-2">
            {averageCompletionRateChartData.map(({ fill, state }) => (
              <div key={state} className="flex items-center gap-2 text-sm text-neutral-700">
                <span className="size-2.5 rounded-full" style={{ backgroundColor: fill }} />
                <span>
                  {
                    averageCompletionRateChartConfig[
                      state as keyof typeof averageCompletionRateChartConfig
                    ].label
                  }
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-primary-100 bg-gradient-to-br from-primary-50 to-white p-6 shadow-sm drop-shadow-card">
          <h4 className="body-lg-md text-center text-neutral-950">
            {t("modernCourseView.contents.completionRate")}
          </h4>
          <p className="body-sm-md text-center text-neutral-800">
            {t("adminCourseView.statistics.overview.completionRateTooltip")}
          </p>

          <ChartContainer
            config={completionRateChartConfig}
            className="mx-auto aspect-square size-full max-h-[250px]"
          >
            <PieChart>
              {!isCompletionRateChartEmpty && (
                <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
              )}
              <Pie
                data={completionRateChartData}
                dataKey="percentage"
                nameKey="state"
                innerRadius={84}
                strokeWidth={5}
                startAngle={90}
                endAngle={-270}
              >
                <Label
                  content={({ viewBox }) => {
                    if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                      return (
                        <text
                          x={viewBox.cx}
                          y={viewBox.cy}
                          textAnchor="middle"
                          dominantBaseline="middle"
                        >
                          <tspan x={viewBox.cx} y={viewBox.cy} className="h3 fill-primary-950">
                            {getPieChartLabel(isCompletionRateChartEmpty, completionPercentage)}
                          </tspan>
                        </text>
                      );
                    }
                  }}
                />
              </Pie>
            </PieChart>
          </ChartContainer>

          <div className="flex flex-col items-center justify-center gap-2">
            {completionRateChartData.map(({ fill, state }) => (
              <div key={state} className="flex items-center gap-2 text-sm text-neutral-700">
                <span className="size-2.5 rounded-full" style={{ backgroundColor: fill }} />
                <span>
                  {completionRateChartConfig[state as keyof typeof completionRateChartConfig].label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
