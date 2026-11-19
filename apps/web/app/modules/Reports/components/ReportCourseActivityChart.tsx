import { useTranslation } from "react-i18next";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, XAxis, YAxis } from "recharts";

import { ChartContainer, ChartTooltip } from "~/components/ui/chart";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import { COURSE_ACTIVITY_CHART } from "../constants/courseActivity.constants";
import { truncateCourseLabel } from "../utils/courseActivity.utils";
import { formatReportDate } from "../utils/reports.utils";

import type { CourseActivityBar } from "../types/courseActivity.types";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { TooltipProps } from "recharts";

function RankedCourseTick({
  x,
  y,
  index,
  payload,
}: {
  x: number;
  y: number;
  index: number;
  payload: { value: string };
}) {
  return (
    <text x={x - 8} y={y} dy={4} textAnchor="end" fontSize={12} className="fill-neutral-800">
      <title>{payload.value}</title>
      <tspan className="fill-neutral-800">{index + 1}. </tspan>
      {truncateCourseLabel(payload.value)}
    </text>
  );
}

function CourseActivityTooltip({
  active,
  payload,
  timezone,
}: TooltipProps<number, string> & { timezone: string }) {
  const { t } = useTranslation();
  const language = useLanguageStore((state) => state.language);
  if (!active || !payload?.length) return null;
  const course = payload[0].payload as CourseActivityBar;

  return (
    <div className="rounded-lg border border-neutral-200 bg-background px-3 py-2 shadow-sm">
      <p className="body-sm-md text-neutral-950">{course.label}</p>
      <p className="details text-neutral-800">
        {t("reports.activity.tooltip.learners", { count: course.activeLearners })}
      </p>
      <p className="details text-neutral-800">
        {t("reports.activity.tooltip.lastActivity", {
          date: formatReportDate(course.lastActivityAt, language, timezone),
        })}
      </p>
    </div>
  );
}

export function CourseActivityPanel({
  icon: PanelIcon,
  title,
  subtitle,
  children,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <section className="flex min-w-0 flex-col rounded-lg border border-neutral-200 bg-white p-5">
      <h3 className="body-base-md flex items-center gap-2 text-neutral-950">
        <PanelIcon className="size-4 text-neutral-800" aria-hidden="true" />
        {title}
      </h3>
      <p className="details text-neutral-800">{subtitle}</p>
      {children}
    </section>
  );
}

export function CourseActivityBarChart({
  bars,
  metricLabel,
  ariaLabel,
  timezone,
  barColors,
}: {
  bars: CourseActivityBar[];
  metricLabel: string;
  ariaLabel: string;
  timezone: string;
  barColors?: string[];
}) {
  return (
    <ChartContainer
      config={{ value: { label: metricLabel, color: "var(--primary-600)" } }}
      className="mt-4 aspect-auto w-full"
      style={{
        height: bars.length * COURSE_ACTIVITY_CHART.BAR_ROW_HEIGHT + COURSE_ACTIVITY_CHART.PADDING,
      }}
      role="img"
      aria-label={ariaLabel}
    >
      <BarChart
        accessibilityLayer
        data={bars}
        layout="vertical"
        margin={{ left: 0, right: 40, top: 0, bottom: 0 }}
        barCategoryGap={10}
      >
        <CartesianGrid horizontal={false} strokeDasharray="3 3" />
        <XAxis
          type="number"
          allowDecimals={false}
          domain={[0, (dataMax: number) => Math.max(dataMax, 1)]}
          hide
        />
        <YAxis
          type="category"
          dataKey="label"
          width={COURSE_ACTIVITY_CHART.LABEL_WIDTH}
          axisLine={false}
          tickLine={false}
          tick={RankedCourseTick}
        />
        <ChartTooltip
          cursor={{ fill: "var(--neutral-50)" }}
          content={<CourseActivityTooltip timezone={timezone} />}
        />
        <Bar
          dataKey="value"
          fill="var(--color-value)"
          radius={4}
          maxBarSize={18}
          background={{ fill: "var(--neutral-100)", radius: 4 }}
        >
          {barColors?.map((color, index) => <Cell key={bars[index].id} fill={color} />)}
          <LabelList
            dataKey="value"
            position="right"
            offset={8}
            className="fill-neutral-800"
            fontSize={12}
          />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

export function ScreenReaderCourseList({
  bars,
  metricLabel,
}: {
  bars: CourseActivityBar[];
  metricLabel: string;
}) {
  return (
    <ul className="sr-only">
      {bars.map((bar) => (
        <li key={bar.id}>
          {bar.label}: {bar.value} {metricLabel}; {bar.lastActivityAt}
        </li>
      ))}
    </ul>
  );
}

export function EmptyCourseActivity() {
  const { t } = useTranslation();
  return (
    <p className="body-sm flex flex-1 items-center justify-center py-10 text-neutral-800">
      {t("reports.activity.empty")}
    </p>
  );
}
