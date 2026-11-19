import { ArrowRight, Route } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";

import { BREAKDOWN_STATUS_COLORS, BREAKDOWN_STATUSES } from "../constants/reportCharts.constants";
import { toBreakdownStatusBar } from "../utils/reportCharts.utils";
import { formatReportPercent } from "../utils/reports.utils";

import type { ReportBreakdownItem } from "../types/reportCharts.types";

type ReportPathCardsProps = {
  paths: ReportBreakdownItem[];
  onPathSelect: (path: ReportBreakdownItem) => void;
};

function ReportPathCard({
  path,
  onPathSelect,
}: {
  path: ReportBreakdownItem;
  onPathSelect: (path: ReportBreakdownItem) => void;
}) {
  const { t } = useTranslation();
  const statusBar = toBreakdownStatusBar(path);
  const statusCounts = {
    [BREAKDOWN_STATUSES.COMPLETED]: path.courseCompletions,
    [BREAKDOWN_STATUSES.IN_PROGRESS]: path.courseInProgress,
    [BREAKDOWN_STATUSES.NOT_STARTED]: Math.max(
      0,
      path.courseEnrollments - path.courseCompletions - path.courseInProgress,
    ),
  };

  return (
    <li className="flex flex-col rounded-lg border border-neutral-200 bg-white">
      <div className="flex items-start gap-3 p-5">
        <Route className="mt-0.5 size-5 shrink-0 text-primary-700" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h3 className="body-base-md line-clamp-2 text-neutral-950">{path.label}</h3>
          <p className="details mt-0.5 text-neutral-800">
            {t("reports.paths.coursesAndLearners", {
              courses: path.courseCount,
              learners: path.learners,
            })}
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-2 px-5 pb-5">
        <div className="details flex items-baseline justify-between gap-3 text-neutral-800">
          <span>{t("reports.paths.enrollmentsByStatus")}</span>
          <span className="body-sm-md shrink-0 text-neutral-950">
            {t("reports.paths.completedShare", {
              percent: formatReportPercent(path.completionRate),
            })}
          </span>
        </div>
        <div
          className="flex h-2 overflow-hidden rounded-full bg-neutral-100"
          role="img"
          aria-label={t("reports.paths.enrollmentsByStatus")}
        >
          {Object.values(BREAKDOWN_STATUSES).map((status) => (
            <span
              key={status}
              className="h-full"
              style={{
                width: `${statusBar[status]}%`,
                backgroundColor: BREAKDOWN_STATUS_COLORS[status],
              }}
            />
          ))}
        </div>
        <ul className="flex flex-wrap gap-x-4 gap-y-1">
          {Object.values(BREAKDOWN_STATUSES).map((status) => (
            <li key={status} className="details flex items-center gap-1.5 text-neutral-800">
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: BREAKDOWN_STATUS_COLORS[status] }}
                aria-hidden="true"
              />
              {t(`reports.values.${status}`)}
              <span className="tabular-nums text-neutral-950">{statusCounts[status]}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-auto flex items-center justify-between gap-3 border-t border-neutral-100 px-5 py-3">
        <p className="details flex items-baseline gap-2 text-neutral-800">
          {t("reports.metrics.averageProgress")}
          <span className="body-sm-md tabular-nums text-neutral-950">
            {formatReportPercent(path.averageProgress)}
          </span>
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 gap-1 px-2 text-primary-700"
          onClick={() => onPathSelect(path)}
        >
          {t("reports.paths.details")}
          <ArrowRight className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </li>
  );
}

export function ReportPathCards({ paths, onPathSelect }: ReportPathCardsProps) {
  const { t } = useTranslation();

  return (
    <section aria-label={t("reports.views.developmentPaths")}>
      {paths.length === 0 ? (
        <p className="body-sm rounded-lg border border-dashed border-neutral-300 bg-white px-6 py-10 text-center text-neutral-800">
          {t("reports.paths.empty")}
        </p>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {paths.map((path) => (
            <ReportPathCard key={path.id} path={path} onPathSelect={onPathSelect} />
          ))}
        </ul>
      )}
    </section>
  );
}
