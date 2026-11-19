import { useTranslation } from "react-i18next";
import { match } from "ts-pattern";

import { ACTIVITY_SUBJECTS } from "../constants/courseActivity.constants";

import { ReportActivityTrendChart } from "./ReportActivityTrendChart";
import { ReportBreakdownChart } from "./ReportBreakdownChart";
import { ReportCourseActivity } from "./ReportCourseActivity";
import { ReportCourseResultsTable } from "./ReportCourseResultsTable";
import { ReportLearningFunnel } from "./ReportLearningFunnel";
import { ReportHeadlineMetrics, ReportOutcomeMetrics } from "./ReportMetrics";
import { ReportPathCards } from "./ReportPathCards";

import type { ReportBreakdownItem } from "../types/reportCharts.types";
import type { ReportActivityPeriod, ReportResult } from "../types/reports-api.types";
import type { ReportView } from "../types/reports.types";
import type { ReactNode } from "react";

type ReportViewResultsProps = {
  view: ReportView;
  result: ReportResult;
  hasSubject: boolean;
  renderRecordsTable: (title?: string) => ReactNode;
  timezone: string;
  isFetching: boolean;
  isPlaceholderData: boolean;
  activityPeriod: ReportActivityPeriod;
  onActivityPeriodChange: (period: ReportActivityPeriod) => void;
  onPathSelect: (path: ReportBreakdownItem) => void;
};

/**
 * Each report tab answers a different question, so each lays out its own metrics. Path and course
 * tabs compare subjects and only list learning records once a single path or course is picked.
 */
export function ReportViewResults({
  view,
  result,
  hasSubject,
  renderRecordsTable,
  timezone,
  isFetching,
  isPlaceholderData,
  activityPeriod,
  onActivityPeriodChange,
  onPathSelect,
}: ReportViewResultsProps) {
  const { t } = useTranslation();
  const activityProps = {
    period: activityPeriod,
    onPeriodChange: onActivityPeriodChange,
    timezone,
    isFetching,
  };
  const insights = isPlaceholderData ? undefined : result.learningInsights;

  return (
    <div className="space-y-6">
      {match(view)
        .with("organisation", () => (
          <>
            <ReportHeadlineMetrics metrics={result.metrics} />
            <div className="grid gap-4 lg:grid-cols-3">
              <ReportBreakdownChart
                className="min-w-0 lg:col-span-2"
                breakdowns={result.breakdowns}
                kinds={["courses", "groups"]}
              />
              <ReportOutcomeMetrics
                metrics={result.metrics}
                aiMentorConversations={insights?.aiMentorConversations}
              />
            </div>
            {insights && (
              <div className="grid gap-4 lg:grid-cols-2">
                <ReportActivityTrendChart trend={insights.activityTrend} />
                <ReportLearningFunnel funnel={insights.funnel} />
              </div>
            )}
            {renderRecordsTable(t("reports.results.tableTitle"))}
          </>
        ))
        .with("developmentPaths", () => (
          <>
            <ReportPathCards paths={result.breakdowns.paths} onPathSelect={onPathSelect} />
            <ReportCourseActivity
              {...activityProps}
              subject={ACTIVITY_SUBJECTS.PATH}
              data={isPlaceholderData ? undefined : result.pathActivity}
            />
            {hasSubject && renderRecordsTable(t("reports.results.tableTitle"))}
          </>
        ))
        .with("course", () => (
          <>
            <ReportCourseResultsTable courses={result.breakdowns.courses} isFetching={isFetching} />
            <ReportCourseActivity
              {...activityProps}
              subject={ACTIVITY_SUBJECTS.COURSE}
              data={isPlaceholderData ? undefined : result.courseActivity}
            />
            {hasSubject && renderRecordsTable(t("reports.results.tableTitle"))}
          </>
        ))
        .with("learner", () => renderRecordsTable())
        .exhaustive()}
    </div>
  );
}
