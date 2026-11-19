import { BarChart3 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";

import { ReportResultsTable } from "./ReportResultsTable";
import { ReportViewResults } from "./ReportViewResults";

import type { ReportBreakdownItem } from "../types/reportCharts.types";
import type { ReportActivityPeriod, ReportResult, ReportSort } from "../types/reports-api.types";
import type { ReportView } from "../types/reports.types";
import type { ComponentProps } from "react";

type ReportResultsProps = {
  result: ReportResult | undefined;
  isLoading: boolean;
  isFetching: boolean;
  isPlaceholderData: boolean;
  error: unknown;
  view: ReportView;
  hasSubject: boolean;
  groupLabels: Map<string, string>;
  language: string;
  timezone: string;
  sort: ReportSort;
  activityPeriod: ReportActivityPeriod;
  onRetry: () => void;
  onActivityPeriodChange: (period: ReportActivityPeriod) => void;
  onPathSelect: (path: ReportBreakdownItem) => void;
} & Pick<
  ComponentProps<typeof ReportResultsTable>,
  "onSortChange" | "onPageChange" | "onPageSizeChange"
>;

function ReportResultsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-[124px] rounded-lg" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-72 rounded-lg lg:col-span-2" />
        <Skeleton className="h-72 rounded-lg" />
      </div>
    </div>
  );
}

export function ReportResults({
  result,
  isLoading,
  isFetching,
  isPlaceholderData,
  error,
  view,
  hasSubject,
  groupLabels,
  language,
  timezone,
  sort,
  activityPeriod,
  onRetry,
  onActivityPeriodChange,
  onPathSelect,
  onSortChange,
  onPageChange,
  onPageSizeChange,
}: ReportResultsProps) {
  const { t } = useTranslation();

  if (isLoading) return <ReportResultsSkeleton />;

  if (error) {
    return (
      <div className="flex flex-col items-center rounded-lg border border-error-200 bg-white px-6 py-12 text-center">
        <p className="body-base-md text-neutral-950">{t("reports.results.errorTitle")}</p>
        <p className="body-sm mt-1 text-neutral-600">
          {getTranslatedApiErrorMessage(error, t, t("reports.results.errorDescription"))}
        </p>
        <Button className="mt-4" variant="outline" onClick={onRetry}>
          {t("reports.results.retry")}
        </Button>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-neutral-300 bg-white px-6 py-16 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-primary-50 text-primary-700">
          <BarChart3 className="size-6" />
        </span>
        <p className="body-sm max-w-sm text-neutral-600">{t("reports.results.chooseSubject")}</p>
      </div>
    );
  }

  return (
    <ReportViewResults
      view={view}
      result={result}
      timezone={timezone}
      isFetching={isFetching}
      isPlaceholderData={isPlaceholderData}
      activityPeriod={activityPeriod}
      onActivityPeriodChange={onActivityPeriodChange}
      onPathSelect={onPathSelect}
      hasSubject={hasSubject}
      renderRecordsTable={(title) => (
        <ReportResultsTable
          title={title}
          hasSubject={hasSubject}
          groupLabels={groupLabels}
          result={result}
          view={view}
          language={language}
          timezone={timezone}
          isFetching={isFetching}
          sort={sort}
          onSortChange={onSortChange}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      )}
    />
  );
}
