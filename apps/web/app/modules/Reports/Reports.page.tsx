import { useSearchParams } from "@remix-run/react";
import { DEFAULT_REPORT_SORT, PERMISSIONS } from "@repo/shared";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useReportOptions } from "~/api/queries/useReportOptions";
import { useReportResult } from "~/api/queries/useReportResult";
import { PageWrapper } from "~/components/PageWrapper";
import { TooltipProvider } from "~/components/ui/tooltip";
import { usePermissions } from "~/hooks/usePermissions";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";
import { ReportExportMenu } from "~/modules/Reports/components/ReportExportMenu";
import { ReportExportStatus } from "~/modules/Reports/components/ReportExportStatus";
import { ReportFilterBuilder } from "~/modules/Reports/components/ReportFilterBuilder";
import { ReportResults } from "~/modules/Reports/components/ReportResults";
import { ReportResultsHeader } from "~/modules/Reports/components/ReportResultsHeader";
import { ReportSavedConfigurations } from "~/modules/Reports/components/ReportSavedConfigurations";
import { ReportSaveDialog } from "~/modules/Reports/components/ReportSaveDialog";
import { ReportScopeNotices } from "~/modules/Reports/components/ReportScopeNotices";
import { ReportScopeToolbar } from "~/modules/Reports/components/ReportScopeToolbar";
import { ReportViewTabs } from "~/modules/Reports/components/ReportViewTabs";
import {
  DEFAULT_ACTIVITY_PERIOD_DAYS,
  DEFAULT_REPORT_CONFIGURATION,
  DEFAULT_REPORT_PAGE_SIZE,
  REPORT_CONFIGURATION_SEARCH_PARAM,
  REPORT_EXPORT_PAGE_SIZE,
} from "~/modules/Reports/constants/reports.constants";
import { useReportExports } from "~/modules/Reports/hooks/useReportExports";
import { useSavedReportConfigurations } from "~/modules/Reports/hooks/useSavedReportConfigurations";
import {
  resetReportConfiguration,
  switchReportView,
} from "~/modules/Reports/utils/reportConfiguration.utils";
import { parseReportConfiguration } from "~/modules/Reports/utils/reportConfigurationParser.utils";
import { incompatibleConditions } from "~/modules/Reports/utils/reportFilters.utils";
import { toReportsQuery } from "~/modules/Reports/utils/reportQuery.utils";
import { getActivityPeriodForLastDays } from "~/modules/Reports/utils/reports.utils";
import { setPageTitle } from "~/utils/setPageTitle";

import type { MetaFunction } from "@remix-run/react";
import type { ReportSort } from "~/modules/Reports/types/reports-api.types";
import type {
  ReportConfiguration,
  ReportInaccessibleReference,
  ReportView,
} from "~/modules/Reports/types/reports.types";

export const meta: MetaFunction = ({ matches }) => setPageTitle(matches, "reports.title");

const toSortedJson = (values: string[]) => JSON.stringify([...values].sort());

export default function ReportsPage() {
  const { t } = useTranslation();
  const language = useLanguageStore((state) => state.language);
  const [searchParams, setSearchParams] = useSearchParams();
  const initialConfiguration = parseReportConfiguration(
    searchParams.get(REPORT_CONFIGURATION_SEARCH_PARAM),
  );
  const [draft, setDraft] = useState<ReportConfiguration>(
    () => initialConfiguration ?? DEFAULT_REPORT_CONFIGURATION,
  );
  const [applied, setApplied] = useState<ReportConfiguration>(
    () => initialConfiguration ?? DEFAULT_REPORT_CONFIGURATION,
  );
  const [isInvalidURLConfiguration, setIsInvalidURLConfiguration] = useState(
    initialConfiguration === null,
  );
  const [activityPeriod, setActivityPeriod] = useState(() =>
    getActivityPeriodForLastDays(DEFAULT_ACTIVITY_PERIOD_DAYS),
  );
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<ReportSort>(DEFAULT_REPORT_SORT);
  const [pageSize, setPageSize] = useState(DEFAULT_REPORT_PAGE_SIZE);
  const [optionSearch, setOptionSearch] = useState("");
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [inaccessibleReference, setInaccessibleReference] =
    useState<ReportInaccessibleReference | null>(null);
  const [incompatibleCount, setIncompatibleCount] = useState(0);
  const { hasAccess: canUseReports } = usePermissions({
    required: [PERMISSIONS.REPORT_READ, PERMISSIONS.MANAGED_GROUP_RESULTS_READ],
  });
  const { data: options } = useReportOptions(language, optionSearch);
  const groupLabels = useMemo(
    () => new Map(options?.groups.map(({ id, label }) => [id, label])),
    [options?.groups],
  );
  const reportQuery = useMemo(
    () => ({
      ...toReportsQuery(applied, language, applied.timezone, page, pageSize, sort),
      activityPeriod,
    }),
    [applied, language, page, pageSize, sort, activityPeriod],
  );
  const isResultEnabled = canUseReports && !isInvalidURLConfiguration;
  const resultQuery = useReportResult(reportQuery, isResultEnabled);
  const result = isResultEnabled ? resultQuery.data : undefined;
  const reportExports = useReportExports(language);
  const savedConfigurations = useSavedReportConfigurations({
    options,
    onRestore: (restored, reference) => {
      setDraft(restored);
      setInaccessibleReference(reference);
      if (restored.filters.conditions.length || restored.filters.groups.length)
        setIsFiltersOpen(true);
    },
  });

  const incompatible = incompatibleConditions(draft.filters, draft.view);
  const isDirty = JSON.stringify(draft) !== JSON.stringify(applied);
  const referencesChanged =
    Boolean(inaccessibleReference) &&
    (draft.subject?.id !== inaccessibleReference?.subjectId ||
      toSortedJson(draft.groupIds) !== toSortedJson(inaccessibleReference?.groupIds ?? []) ||
      JSON.stringify(draft.filters) !== inaccessibleReference?.filters);
  const canApply =
    isDirty &&
    !isInvalidURLConfiguration &&
    !incompatible.length &&
    (!inaccessibleReference || referencesChanged);
  const warnings = [
    incompatible.length > 0 && t("reports.filters.incompatible", { count: incompatible.length }),
    isInvalidURLConfiguration && t("reports.results.invalidConfiguration"),
    inaccessibleReference && !referencesChanged && t("reports.saved.inaccessibleConfiguration"),
  ].filter((warning): warning is string => Boolean(warning));

  useEffect(() => {
    const next = parseReportConfiguration(searchParams.get(REPORT_CONFIGURATION_SEARCH_PARAM));
    setIsInvalidURLConfiguration(next === null);
    setDraft(next ?? DEFAULT_REPORT_CONFIGURATION);
    setApplied(next ?? DEFAULT_REPORT_CONFIGURATION);
  }, [searchParams]);

  useEffect(() => {
    if (searchParams.has(REPORT_CONFIGURATION_SEARCH_PARAM)) return;
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setApplied((current) => ({ ...current, timezone }));
    setDraft((current) => ({ ...current, timezone }));
  }, [searchParams]);

  const applyReportConfiguration = (configuration: ReportConfiguration) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set(REPORT_CONFIGURATION_SEARCH_PARAM, JSON.stringify(configuration));
    setSearchParams(nextParams, { replace: false });
    setApplied(configuration);
    setIsInvalidURLConfiguration(false);
    setInaccessibleReference(null);
    setPage(1);
  };

  /** Tabs open their report straight away unless the applied conditions do not fit the new view. */
  const pickView = (view: ReportView) => {
    const nextDraft = switchReportView(draft, view);
    const nextApplied = switchReportView(applied, view);
    setDraft(nextDraft.configuration);
    setIncompatibleCount(nextDraft.incompatible.length);
    if (!nextApplied.incompatible.length) applyReportConfiguration(nextApplied.configuration);
  };

  const resetAll = () => {
    const reset = resetReportConfiguration(draft);
    setDraft(reset);
    setIncompatibleCount(0);
    setActivityPeriod(getActivityPeriodForLastDays(DEFAULT_ACTIVITY_PERIOD_DAYS));
    applyReportConfiguration(reset);
  };

  const toggleGroup = (groupId: string) =>
    setDraft((current) => ({
      ...current,
      groupIds: current.groupIds.includes(groupId)
        ? current.groupIds.filter((id) => id !== groupId)
        : [...current.groupIds, groupId],
    }));

  const resetPageAfter =
    <Value,>(update: (value: Value) => void) =>
    (value: Value) => {
      update(value);
      setPage(1);
    };

  return (
    <PageWrapper breadcrumbs={[{ title: t("navigationSideBar.reports"), href: "/reports" }]}>
      <TooltipProvider>
        <div className="flex flex-col gap-6">
          <header className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <h1 className="h4 text-neutral-950">{t("reports.title")}</h1>
              <p className="body-sm max-w-2xl text-neutral-600">{t("reports.description")}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <ReportSavedConfigurations
                configurations={savedConfigurations.configurations}
                isLoading={savedConfigurations.isLoadingConfigurations}
                activeConfigurationId={savedConfigurations.activeConfigurationId}
                canManageShared={savedConfigurations.canManageShared}
                onOpen={savedConfigurations.openSavedConfiguration}
                onDelete={savedConfigurations.deleteSavedConfiguration}
                onSaveCurrent={() => savedConfigurations.setIsSaveFormOpen(true)}
              />
              <ReportExportMenu
                disabled={reportExports.isExporting || !result}
                onExport={(format) =>
                  reportExports.startExport(
                    format,
                    toReportsQuery(
                      applied,
                      language,
                      applied.timezone,
                      1,
                      REPORT_EXPORT_PAGE_SIZE,
                      sort,
                    ),
                  )
                }
              />
            </div>
          </header>

          <ReportViewTabs view={draft.view} onViewChange={pickView} />

          <section className="rounded-lg border border-neutral-200 bg-white">
            <ReportScopeToolbar
              draft={draft}
              options={options}
              isDirty={isDirty}
              canApply={canApply}
              isFiltersOpen={isFiltersOpen}
              onOptionSearch={setOptionSearch}
              onSubjectSelect={({ id, label, type }) =>
                setDraft((current) => ({
                  ...current,
                  subject: id ? { id, name: label, type } : null,
                }))
              }
              onGroupToggle={toggleGroup}
              onFiltersToggle={() => setIsFiltersOpen((open) => !open)}
              onReset={resetAll}
              onDiscard={() => setDraft(applied)}
              onApply={() => applyReportConfiguration(draft)}
            />
            {isFiltersOpen && (
              <div className="border-t border-neutral-100 p-4">
                <ReportFilterBuilder
                  value={draft.filters}
                  options={{
                    groupId: options?.groups,
                    learner: options?.learners,
                    courseId: options?.courses,
                    pathId: options?.paths,
                  }}
                  onOptionSearch={setOptionSearch}
                  onChange={(filters) => setDraft((current) => ({ ...current, filters }))}
                />
              </div>
            )}
            <ReportScopeNotices
              warnings={warnings}
              adaptedConditionCount={incompatible.length === 0 ? incompatibleCount : 0}
            />
          </section>

          {reportExports.activeExport && (
            <ReportExportStatus
              reportExport={reportExports.activeExport}
              isDownloading={reportExports.isDownloading}
              onDownload={reportExports.downloadCompletedExport}
              onDismiss={reportExports.dismissExport}
            />
          )}

          <main className="flex min-w-0 flex-col gap-4">
            <ReportResultsHeader
              applied={applied}
              capturedAt={result?.capturedAt}
              language={language}
            />
            <ReportResults
              result={result}
              isLoading={resultQuery.isLoading}
              isFetching={resultQuery.isFetching}
              isPlaceholderData={resultQuery.isPlaceholderData}
              error={resultQuery.isError ? resultQuery.error : null}
              view={applied.view}
              hasSubject={Boolean(applied.subject)}
              groupLabels={groupLabels}
              language={language}
              timezone={applied.timezone}
              sort={sort}
              activityPeriod={activityPeriod}
              onRetry={() => resultQuery.refetch()}
              onActivityPeriodChange={resetPageAfter(setActivityPeriod)}
              onPathSelect={({ id, label }) => {
                const withPath = { ...draft, subject: { id, name: label, type: "path" as const } };
                setDraft(withPath);
                applyReportConfiguration(withPath);
              }}
              onSortChange={resetPageAfter(setSort)}
              onPageChange={setPage}
              onPageSizeChange={resetPageAfter(setPageSize)}
            />
          </main>
        </div>
      </TooltipProvider>

      <ReportSaveDialog
        open={savedConfigurations.isSaveFormOpen}
        name={savedConfigurations.saveName}
        visibility={savedConfigurations.saveVisibility}
        canManageShared={savedConfigurations.canManageShared}
        isUpdate={Boolean(savedConfigurations.activeConfigurationId)}
        isPending={savedConfigurations.isSaving}
        onNameChange={savedConfigurations.setSaveName}
        onVisibilityChange={savedConfigurations.setSaveVisibility}
        onOpenChange={savedConfigurations.setIsSaveFormOpen}
        onSave={() => savedConfigurations.saveConfiguration(draft)}
      />
    </PageWrapper>
  );
}
