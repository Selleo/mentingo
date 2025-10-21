import type { ProgressStatus } from "../../lessonTypes";
import type i18next from "i18next";
import type { ChartConfig } from "~/components/ui/chart";

export const getCourseStatusDistributionOptions = (
  t: typeof i18next.t,
  statusCounts: Record<ProgressStatus, number>,
) => {
  const totalCount =
    (statusCounts.completed || 0) +
    (statusCounts.in_progress || 0) +
    (statusCounts.not_started || 0);

  if (totalCount === 0) {
    return {
      chartConfig: {
        count: {
          label: t("adminCourseView.statistics.overview.courseStatusDistribution"),
        },
      } satisfies ChartConfig,
      chartData: [{ status: "No data", count: 1, fill: "var(--neutral-200)" }],
      isEmpty: true,
    };
  }

  const chartConfig = {
    count: {
      label: t("adminCourseView.statistics.overview.courseStatusDistribution"),
    },
    Completed: {
      label: t("progressBadge.completed"),
      color: "var(--success-500)",
    },
    "In progress": {
      label: t("progressBadge.inProgress"),
      color: "var(--warning-500)",
    },
    "Not started": {
      label: t("progressBadge.notStarted"),
      color: "var(--neutral-200)",
    },
  } satisfies ChartConfig;

  const chartData = [
    {
      status: t("progressBadge.completed"),
      count: statusCounts.completed ?? 0,
      fill: "var(--success-500)",
    },
    {
      status: t("progressBadge.inProgress"),
      count: statusCounts.in_progress ?? 0,
      fill: "var(--warning-500)",
    },
    {
      status: t("progressBadge.notStarted"),
      count: statusCounts.not_started ?? 0,
      fill: "var(--neutral-200)",
    },
  ];

  return { chartConfig, chartData, isEmpty: false };
};
