import { BREAKDOWN_STATUSES } from "../constants/reportCharts.constants";

import { formatReportPercent } from "./reports.utils";

import type {
  BreakdownStatusBar,
  ReportBreakdownItem,
  ReportLearningInsights,
} from "../types/reportCharts.types";

const toShare = (count: number, total: number) => (total ? (count * 100) / total : 0);

export const toBreakdownStatusBar = (item: ReportBreakdownItem): BreakdownStatusBar => {
  const notStarted = Math.max(
    0,
    item.courseEnrollments - item.courseCompletions - item.courseInProgress,
  );
  return {
    ...item,
    [BREAKDOWN_STATUSES.COMPLETED]: toShare(item.courseCompletions, item.courseEnrollments),
    [BREAKDOWN_STATUSES.IN_PROGRESS]: toShare(item.courseInProgress, item.courseEnrollments),
    [BREAKDOWN_STATUSES.NOT_STARTED]: toShare(notStarted, item.courseEnrollments),
    completionLabel: formatReportPercent(item.completionRate),
  };
};

/** Percentage change of active learners between the last two months, or null without a base. */
export const getActivityTrendChange = (trend: ReportLearningInsights["activityTrend"]) => {
  const [previousMonth, currentMonth] = trend.slice(-2);
  if (!previousMonth || !currentMonth || !previousMonth.activeLearners) return null;
  return Math.round(
    ((currentMonth.activeLearners - previousMonth.activeLearners) * 100) /
      previousMonth.activeLearners,
  );
};
