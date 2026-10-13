import { useSearchParams } from "@remix-run/react";
import { PERMISSIONS } from "@repo/shared";
import {
  AlertTriangle,
  BookOpen,
  Building2,
  BarChart3,
  Info,
  RotateCcw,
  Route,
  SlidersHorizontal,
  UserRound,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { match } from "ts-pattern";

import { useCreateReportConfiguration } from "~/api/mutations/useCreateReportConfiguration";
import { useCreateReportExport } from "~/api/mutations/useCreateReportExport";
import { useDeleteReportConfiguration } from "~/api/mutations/useDeleteReportConfiguration";
import { useDownloadReportExport } from "~/api/mutations/useDownloadReportExport";
import { useUpdateReportConfiguration } from "~/api/mutations/useUpdateReportConfiguration";
import { useReportConfigurations } from "~/api/queries/useReportConfigurations";
import { useReportExportStatus } from "~/api/queries/useReportExportStatus";
import { useReportOptions } from "~/api/queries/useReportOptions";
import { useReportResult } from "~/api/queries/useReportResult";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { PageWrapper } from "~/components/PageWrapper";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";
import { usePermissions } from "~/hooks/usePermissions";
import { cn } from "~/lib/utils";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";
import { ReportBreakdownChart } from "~/modules/Reports/components/ReportBreakdownChart";
import { ReportExportMenu } from "~/modules/Reports/components/ReportExportMenu";
import { ReportExportStatus } from "~/modules/Reports/components/ReportExportStatus";
import {
  ReportHeadlineMetrics,
  ReportOutcomeMetrics,
} from "~/modules/Reports/components/ReportMetrics";
import { ReportOptionPicker } from "~/modules/Reports/components/ReportOptionPicker";
import { ReportResultsTable } from "~/modules/Reports/components/ReportResultsTable";
import { ReportSavedConfigurations } from "~/modules/Reports/components/ReportSavedConfigurations";
import { ReportSaveDialog } from "~/modules/Reports/components/ReportSaveDialog";
import { ReportFilterBuilder } from "~/modules/Reports/ReportFilterBuilder";
import { toReportDefinition, toReportsQuery } from "~/modules/Reports/reports-api.types";
import {
  countConditions,
  EMPTY_FILTERS,
  incompatibleConditions,
  MAX_REPORT_CONDITIONS,
  resetReportConfiguration,
  switchReportView,
} from "~/modules/Reports/reports.types";
import { formatReportDate } from "~/modules/Reports/reports.utils";
import { setPageTitle } from "~/utils/setPageTitle";

import { REPORTS_HANDLES } from "../../../e2e/data/reports/handles";

import type { MetaFunction } from "@remix-run/react";
import type { LucideIcon } from "lucide-react";
import type {
  FilterJoin,
  ReportCondition,
  ReportConfiguration,
  ReportFilterField,
  ReportSubject,
  ReportView,
} from "~/modules/Reports/reports.types";

const DEFAULT_PAGE_SIZE = 10;

export const meta: MetaFunction = ({ matches }) => setPageTitle(matches, "reports.title");

const DEFAULT_CONFIG: ReportConfiguration = {
  view: "organisation",
  timezone: "UTC",
  subject: null,
  groupIds: [],
  filters: EMPTY_FILTERS,
};

const viewKeys: ReportView[] = ["organisation", "developmentPaths", "course", "learner"];
const viewTabs: { view: ReportView; icon: LucideIcon }[] = [
  { view: "organisation", icon: Building2 },
  { view: "developmentPaths", icon: Route },
  { view: "course", icon: BookOpen },
  { view: "learner", icon: UserRound },
];
const fieldKeys: ReportFilterField[] = [
  "groupId",
  "learner",
  "courseId",
  "pathId",
  "status",
  "progress",
  "enrolledAt",
  "completedAt",
  "score",
  "attempts",
  "certificate",
  "lastActivity",
];
const operatorKeys = [
  "eq",
  "neq",
  "in",
  "contains",
  "gte",
  "lte",
  "between",
  "isEmpty",
  "isNotEmpty",
] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const newId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;

function subjectTypeForView(view: ReportView): Exclude<ReportSubject, null>["type"] | null {
  if (view === "course") return "course";
  if (view === "developmentPaths") return "path";
  if (view === "learner") return "learner";
  return null;
}

function restoreCondition(condition: {
  field: string;
  operator: string;
  value?: string | number | (string | number)[];
}): ReportCondition {
  const rangeValues =
    condition.operator === "between" && Array.isArray(condition.value)
      ? condition.value
      : undefined;
  return {
    id: newId(),
    field: condition.field as ReportFilterField,
    operator: condition.operator as ReportCondition["operator"],
    value: rangeValues ? rangeValues[0] : (condition.value as ReportCondition["value"]),
    secondValue: rangeValues ? rangeValues[1] : undefined,
  };
}

function getSubjectOptions(
  options:
    | {
        courses: { id: string; label: string }[];
        paths: { id: string; label: string }[];
        learners: { id: string; label: string }[];
      }
    | undefined,
  type: Exclude<ReportSubject, null>["type"] | null,
) {
  if (type === "course") return options?.courses;
  if (type === "path") return options?.paths;
  if (type === "learner") return options?.learners;
  return undefined;
}

function parseConfiguration(raw: string | null): ReportConfiguration | null {
  if (!raw) return DEFAULT_CONFIG;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      !isRecord(parsed) ||
      typeof parsed.view !== "string" ||
      !viewKeys.includes(parsed.view as ReportView)
    )
      return null;
    const filters = isRecord(parsed.filters) ? parsed.filters : {};
    if (filters.join !== "and" && filters.join !== "or") return null;
    const conditions = Array.isArray(filters.conditions) ? filters.conditions : [];
    const groups = Array.isArray(filters.groups) ? filters.groups : [];
    if (groups.length > 1) return null;
    const validCondition = (value: unknown): value is ReportCondition => {
      if (!isRecord(value)) return false;
      const validValue =
        value.value === undefined ||
        typeof value.value === "string" ||
        typeof value.value === "number" ||
        (Array.isArray(value.value) &&
          value.value.every((item) => typeof item === "string" || typeof item === "number"));
      return (
        typeof value.id === "string" &&
        fieldKeys.includes(value.field as ReportFilterField) &&
        operatorKeys.includes(value.operator as (typeof operatorKeys)[number]) &&
        validValue
      );
    };
    const validConditions = conditions.filter(validCondition);
    if (validConditions.length !== conditions.length) return null;
    const validGroups = groups.flatMap((value) => {
      if (
        !isRecord(value) ||
        typeof value.id !== "string" ||
        (value.join !== "and" && value.join !== "or") ||
        !Array.isArray(value.conditions)
      )
        return [];
      const rules = value.conditions.filter(validCondition);
      if (rules.length !== value.conditions.length) return [];
      return rules.length
        ? [{ id: value.id, join: value.join as FilterJoin, conditions: rules }]
        : [];
    });
    if (groups.length !== validGroups.length) return null;
    const normalizedConditionCount =
      validConditions.length +
      validGroups.reduce((total, group) => total + group.conditions.length, 0);
    if (normalizedConditionCount > MAX_REPORT_CONDITIONS) return null;
    if (
      parsed.groupIds !== undefined &&
      (!Array.isArray(parsed.groupIds) ||
        parsed.groupIds.length > 100 ||
        !parsed.groupIds.every((id) => typeof id === "string"))
    )
      return null;
    const subjectValue = isRecord(parsed.subject) ? parsed.subject : null;
    const subjectType = subjectValue?.type;
    const isSubjectType =
      subjectType === "course" || subjectType === "path" || subjectType === "learner";
    if (
      parsed.subject !== null &&
      parsed.subject !== undefined &&
      (!subjectValue ||
        typeof subjectValue.id !== "string" ||
        typeof subjectValue.name !== "string" ||
        !isSubjectType)
    )
      return null;
    const timezone = typeof parsed.timezone === "string" ? parsed.timezone : "UTC";
    if (timezone.length > 100) return null;
    try {
      new Intl.DateTimeFormat("en", { timeZone: timezone });
    } catch {
      return null;
    }
    const subject =
      subjectValue &&
      typeof subjectValue.id === "string" &&
      typeof subjectValue.name === "string" &&
      isSubjectType
        ? {
            id: subjectValue.id,
            name: subjectValue.name,
            type: subjectType as Exclude<ReportSubject, null>["type"],
          }
        : null;
    return {
      view: parsed.view as ReportView,
      timezone,
      subject,
      groupIds: Array.isArray(parsed.groupIds) ? (parsed.groupIds as string[]) : [],
      filters: {
        join: filters.join,
        conditions: validConditions,
        groups: validGroups,
      },
    };
  } catch {
    return null;
  }
}

export default function ReportsPage() {
  const { t } = useTranslation();
  const language = useLanguageStore((state) => state.language);
  const [searchParams, setSearchParams] = useSearchParams();
  const initialConfiguration = parseConfiguration(searchParams.get("reportConfig"));
  const [draft, setDraft] = useState<ReportConfiguration>(
    () => initialConfiguration ?? DEFAULT_CONFIG,
  );
  const [applied, setApplied] = useState<ReportConfiguration>(
    () => initialConfiguration ?? DEFAULT_CONFIG,
  );
  const [isInvalidURLConfiguration, setIsInvalidURLConfiguration] = useState(
    initialConfiguration === null,
  );
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [optionSearch, setOptionSearch] = useState("");
  const [saveName, setSaveName] = useState("");
  const [saveVisibility, setSaveVisibility] = useState<"personal" | "shared">("personal");
  const [isSaveFormOpen, setIsSaveFormOpen] = useState(false);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [activeConfigurationId, setActiveConfigurationId] = useState<string>();
  const [inaccessibleReference, setInaccessibleReference] = useState<{
    subjectId?: string;
    groupIds: string[];
    filters: string;
  } | null>(null);
  const [exportId, setExportId] = useState<string>();
  const autoDownloadedExportIdRef = useRef<string>();
  const [incompatibleCount, setIncompatibleCount] = useState(0);
  const { hasAccess: canUseReports } = usePermissions({
    required: [PERMISSIONS.REPORT_READ, PERMISSIONS.MANAGED_GROUP_RESULTS_READ],
  });
  const optionsQuery = useReportOptions(language, optionSearch);
  const configurationsQuery = useReportConfigurations();
  const currentTimezone = applied.timezone;
  const reportQuery = useMemo(
    () => toReportsQuery(applied, language, currentTimezone, page, pageSize),
    [applied, currentTimezone, language, page, pageSize],
  );
  const isResultEnabled =
    canUseReports &&
    !isInvalidURLConfiguration &&
    (applied.view === "organisation" || Boolean(applied.subject?.id));
  const resultQuery = useReportResult(reportQuery, isResultEnabled);
  const { mutateAsync: createConfiguration, isPending: isSaving } = useCreateReportConfiguration();
  const { mutateAsync: updateConfiguration, isPending: isUpdating } =
    useUpdateReportConfiguration();
  const { mutateAsync: deleteConfiguration } = useDeleteReportConfiguration();
  const { mutateAsync: createExport, isPending: isExporting } = useCreateReportExport();
  const { mutateAsync: downloadExport, isPending: isDownloading } = useDownloadReportExport();
  const exportStatusQuery = useReportExportStatus(exportId);
  const options = optionsQuery.data;
  const result = isResultEnabled ? resultQuery.data : undefined;
  const configs = configurationsQuery.data ?? [];
  const incompatible = incompatibleConditions(draft.filters, draft.view);
  const isDirty = JSON.stringify(draft) !== JSON.stringify(applied);
  const subjectRequired = draft.view !== "organisation";
  const referencesChanged =
    Boolean(inaccessibleReference) &&
    (draft.subject?.id !== inaccessibleReference?.subjectId ||
      JSON.stringify([...draft.groupIds].sort()) !==
        JSON.stringify([...(inaccessibleReference?.groupIds ?? [])].sort()) ||
      JSON.stringify(draft.filters) !== inaccessibleReference?.filters);
  const canApply =
    isDirty &&
    !isInvalidURLConfiguration &&
    !incompatible.length &&
    (!inaccessibleReference || referencesChanged) &&
    (!subjectRequired || Boolean(draft.subject));

  useEffect(() => {
    const raw = searchParams.get("reportConfig");
    const next = parseConfiguration(raw);
    setIsInvalidURLConfiguration(next === null);
    setDraft(next ?? DEFAULT_CONFIG);
    setApplied(next ?? DEFAULT_CONFIG);
  }, [searchParams]);

  useEffect(() => {
    if (searchParams.has("reportConfig")) return;
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setApplied((current) => ({ ...current, timezone }));
    setDraft((current) => ({ ...current, timezone }));
  }, [searchParams]);

  const applyConfiguration = () => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("reportConfig", JSON.stringify(draft));
    setSearchParams(nextParams, { replace: false });
    setApplied(draft);
    setIsInvalidURLConfiguration(false);
    setInaccessibleReference(null);
    setPage(1);
  };

  const pickView = (view: ReportView) => {
    const next = switchReportView(draft, view);
    setDraft(next.configuration);
    setIncompatibleCount(next.incompatible.length);
  };

  const resetAll = () => {
    const reset = resetReportConfiguration(draft);
    setDraft(reset);
    setIncompatibleCount(0);
    if (isInvalidURLConfiguration) {
      setApplied(reset);
      setIsInvalidURLConfiguration(false);
      setInaccessibleReference(null);
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          next.delete("reportConfig");
          return next;
        },
        { replace: false },
      );
    }
  };

  const selectSubject = (id: string, label: string, type: Exclude<ReportSubject, null>["type"]) => {
    setDraft((current) => ({ ...current, subject: id ? { id, name: label, type } : null }));
  };

  const getFilterOptions = (): Partial<
    Record<ReportFilterField, { id: string; label: string }[]>
  > => ({
    groupId: options?.groups,
    learner: options?.learners,
    courseId: options?.courses,
    pathId: options?.paths,
  });

  const openSavedConfiguration = (saved: (typeof configs)[number]) => {
    const query = saved.query;
    const subjectType = subjectTypeForView(query.view);
    const subjectOptions = getSubjectOptions(options, subjectType);
    const subjectOption = subjectOptions?.find(({ id }) => id === query.subjectId);
    const queryRules = query.filter?.rules ?? [];
    const rootConditions = queryRules.flatMap((rule) =>
      "field" in rule ? [restoreCondition(rule)] : [],
    );
    const groups = queryRules.flatMap((rule) => {
      if (!("match" in rule)) return [];
      return [
        {
          id: newId(),
          join: rule.match === "any" ? ("or" as const) : ("and" as const),
          conditions: rule.rules.map(restoreCondition),
        },
      ];
    });
    let subject: ReportSubject = null;
    if (subjectType && query.subjectId) {
      subject = {
        id: query.subjectId,
        type: subjectType,
        name: subjectOption?.label ?? t("reports.saved.inaccessibleSubject"),
      };
    }
    const restored: ReportConfiguration = {
      view: query.view,
      timezone: query.timezone,
      subject,
      groupIds: query.groupIds,
      filters: {
        join: query.filter?.match === "any" ? "or" : "and",
        conditions: rootConditions,
        groups,
      },
    };
    setDraft(restored);
    setActiveConfigurationId(
      saved.visibility === "personal" || options?.canManageShared ? saved.id : undefined,
    );
    const isAvailable = "isAvailable" in saved ? saved.isAvailable : true;
    setInaccessibleReference(
      isAvailable
        ? null
        : {
            subjectId: query.subjectId,
            groupIds: query.groupIds,
            filters: JSON.stringify(restored.filters),
          },
    );
    setSaveName(saved.name);
    if (restored.filters.conditions.length || restored.filters.groups.length)
      setIsFiltersOpen(true);
    setSaveVisibility(
      saved.visibility === "shared" && !options?.canManageShared ? "personal" : saved.visibility,
    );
  };

  const saveCurrentConfiguration = async () => {
    const query = toReportDefinition(draft, draft.timezone);
    if (activeConfigurationId) {
      await updateConfiguration({
        id: activeConfigurationId,
        name: saveName,
        visibility: saveVisibility,
        query,
      });
    } else {
      const saved = await createConfiguration({
        name: saveName,
        visibility: saveVisibility,
        query,
      });
      setActiveConfigurationId(saved.id);
    }
    setSaveName("");
    setIsSaveFormOpen(false);
  };

  const startExport = async (format: "xlsx" | "pdf") => {
    const exported = await createExport({
      format,
      language,
      query: toReportsQuery(applied, language, currentTimezone, 1, 100),
    });
    setExportId(exported.id);
  };

  const downloadCompletedExport = async () => {
    const exportFile = exportStatusQuery.data;
    if (!exportFile || exportFile.status !== "completed") return;
    await downloadExport({ id: exportFile.id, fileName: `mentingo-report.${exportFile.format}` });
  };

  useEffect(() => {
    const exportFile = exportStatusQuery.data;
    if (exportFile?.status !== "completed") return;
    if (autoDownloadedExportIdRef.current === exportFile.id) return;

    autoDownloadedExportIdRef.current = exportFile.id;
    void downloadExport({ id: exportFile.id, fileName: `mentingo-report.${exportFile.format}` });
  }, [exportStatusQuery.data, downloadExport]);

  const subjectType = subjectTypeForView(draft.view);
  const subjectItems = getSubjectOptions(options, subjectType);
  const draftConditionCount = countConditions(draft.filters);
  const groupPickerLabel = match(draft.groupIds.length)
    .with(0, () => t("reports.scope.allGroups"))
    .with(
      1,
      () =>
        options?.groups.find(({ id }) => id === draft.groupIds[0])?.label ??
        t("reports.scope.groupsCount", { count: 1 }),
    )
    .otherwise((count) => t("reports.scope.groupsCount", { count }));
  const toggleGroup = (groupId: string) =>
    setDraft((current) => ({
      ...current,
      groupIds: current.groupIds.includes(groupId)
        ? current.groupIds.filter((id) => id !== groupId)
        : [...current.groupIds, groupId],
    }));

  const activeExport = exportStatusQuery.data;
  const resultTitle = applied.subject
    ? `${t(`reports.views.${applied.view}`)} · ${applied.subject.name}`
    : t(`reports.views.${applied.view}`);
  const warnings = [
    incompatible.length > 0 && t("reports.filters.incompatible", { count: incompatible.length }),
    isInvalidURLConfiguration && t("reports.results.invalidConfiguration"),
    inaccessibleReference && !referencesChanged && t("reports.saved.inaccessibleConfiguration"),
  ].filter((warning): warning is string => Boolean(warning));
  const showAdaptedNotice = incompatibleCount > 0 && incompatible.length === 0;

  const renderResults = () => {
    if (resultQuery.isLoading) {
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
    if (resultQuery.isError) {
      return (
        <div className="flex flex-col items-center rounded-lg border border-error-200 bg-white px-6 py-12 text-center">
          <p className="body-base-md text-neutral-950">{t("reports.results.errorTitle")}</p>
          <p className="body-sm mt-1 text-neutral-600">
            {getTranslatedApiErrorMessage(
              resultQuery.error,
              t,
              t("reports.results.errorDescription"),
            )}
          </p>
          <Button className="mt-4" variant="outline" onClick={() => resultQuery.refetch()}>
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
      <div className="space-y-4">
        <ReportHeadlineMetrics metrics={result.metrics} />
        <div className="grid gap-4 lg:grid-cols-3">
          <ReportBreakdownChart className="min-w-0 lg:col-span-2" breakdowns={result.breakdowns} />
          <ReportOutcomeMetrics metrics={result.metrics} />
        </div>
        <ReportResultsTable
          result={result}
          view={applied.view}
          language={language}
          timezone={currentTimezone}
          isFetching={resultQuery.isFetching}
          onPageChange={setPage}
          onPageSizeChange={(nextPageSize) => {
            setPageSize(nextPageSize);
            setPage(1);
          }}
        />
      </div>
    );
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
                configurations={configs}
                isLoading={configurationsQuery.isLoading}
                activeConfigurationId={activeConfigurationId}
                canManageShared={Boolean(options?.canManageShared)}
                onOpen={openSavedConfiguration}
                onDelete={(saved) => {
                  deleteConfiguration(saved.id);
                  if (activeConfigurationId === saved.id) setActiveConfigurationId(undefined);
                }}
                onSaveCurrent={() => setIsSaveFormOpen(true)}
              />
              <ReportExportMenu disabled={isExporting || !result} onExport={startExport} />
            </div>
          </header>

          <Tabs value={draft.view} onValueChange={(view) => pickView(view as ReportView)}>
            <div className="overflow-x-auto border-b">
              <TabsList
                aria-label={t("reports.views.title")}
                className="h-auto min-w-max justify-start gap-2 rounded-none bg-transparent p-0"
              >
                {viewTabs.map(({ view, icon: ViewIcon }) => (
                  <TabsTrigger
                    key={view}
                    value={view}
                    className="gap-2 rounded-none border-b-2 border-transparent px-4 py-3 data-[state=active]:border-primary-600 data-[state=active]:bg-transparent data-[state=active]:text-primary-700 data-[state=active]:shadow-none"
                  >
                    <ViewIcon className="size-4" aria-hidden="true" />
                    {t(`reports.views.${view}`)}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
          </Tabs>

          <section className="rounded-lg border border-neutral-200 bg-white">
            <div className="flex flex-col gap-4 p-4">
              <div className="flex flex-wrap items-center gap-2">
                {subjectType && (
                  <ReportOptionPicker
                    label={t(`reports.subject.${subjectType}`)}
                    placeholder={t(
                      `reports.subject.choose${subjectType[0].toUpperCase()}${subjectType.slice(1)}`,
                    )}
                    options={subjectItems}
                    selectedIds={draft.subject ? [draft.subject.id] : []}
                    selectedLabel={draft.subject?.name}
                    className="w-full sm:w-64"
                    onSearchChange={setOptionSearch}
                    onToggle={({ id, label }) => selectSubject(id, label, subjectType)}
                  />
                )}
                <ReportOptionPicker
                  label={t("reports.scope.groupLabel")}
                  placeholder={t("reports.scope.allGroups")}
                  options={options?.groups}
                  selectedIds={draft.groupIds}
                  selectedLabel={groupPickerLabel}
                  multiple
                  className="w-full sm:w-52"
                  onSearchChange={setOptionSearch}
                  onToggle={({ id }) => toggleGroup(id)}
                />
                <Button
                  data-testid={REPORTS_HANDLES.FILTERS_TOGGLE}
                  type="button"
                  variant="outline"
                  className={cn("gap-2", isFiltersOpen && "border-primary-500 bg-primary-50")}
                  aria-expanded={isFiltersOpen}
                  onClick={() => setIsFiltersOpen((open) => !open)}
                >
                  <SlidersHorizontal className="size-4" />
                  {t("reports.filters.toggle")}
                  {draftConditionCount > 0 && (
                    <span className="details-md rounded-full bg-primary-700 px-1.5 text-contrast">
                      {draftConditionCount}
                    </span>
                  )}
                </Button>
                <Button
                  data-testid={REPORTS_HANDLES.RESET_ALL}
                  type="button"
                  variant="ghost"
                  className="gap-2 text-neutral-700"
                  onClick={resetAll}
                >
                  <RotateCcw className="size-4" />
                  {t("reports.filters.resetAll")}
                </Button>
                <div className="flex w-full items-center justify-end gap-2 sm:ml-auto sm:w-auto">
                  {isDirty && (
                    <Button
                      type="button"
                      variant="ghost"
                      className="text-neutral-700"
                      onClick={() => setDraft(applied)}
                    >
                      {t("reports.filters.discardChanges")}
                    </Button>
                  )}
                  <Button
                    data-testid={REPORTS_HANDLES.APPLY}
                    type="button"
                    className="gap-2"
                    disabled={!canApply}
                    onClick={applyConfiguration}
                  >
                    {isDirty && (
                      <span aria-hidden className="size-1.5 rounded-full bg-warning-400" />
                    )}
                    {t("reports.filters.apply")}
                  </Button>
                </div>
              </div>
            </div>
            {isFiltersOpen && (
              <div className="border-t border-neutral-100 p-4">
                <ReportFilterBuilder
                  value={draft.filters}
                  options={getFilterOptions()}
                  onOptionSearch={setOptionSearch}
                  onChange={(filters) => setDraft((current) => ({ ...current, filters }))}
                />
              </div>
            )}
            {(warnings.length > 0 || showAdaptedNotice) && (
              <div className="space-y-2 border-t border-neutral-100 p-4">
                {warnings.map((warning) => (
                  <div
                    key={warning}
                    role="alert"
                    className="body-sm flex items-start gap-2 rounded-lg border border-warning-200 bg-warning-50 px-3 py-2 text-warning-900"
                  >
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                    {warning}
                  </div>
                ))}
                {showAdaptedNotice && (
                  <div className="body-sm flex items-start gap-2 rounded-lg border border-primary-100 bg-primary-50 px-3 py-2 text-primary-900">
                    <Info className="mt-0.5 size-4 shrink-0" />
                    {t("reports.filters.adaptedNotice", { count: incompatibleCount })}
                  </div>
                )}
              </div>
            )}
          </section>

          {activeExport && (
            <ReportExportStatus
              reportExport={activeExport}
              isDownloading={isDownloading}
              onDownload={downloadCompletedExport}
              onDismiss={() => setExportId(undefined)}
            />
          )}

          <main className="flex min-w-0 flex-col gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="h6 text-neutral-950">{resultTitle}</h2>
                <Tooltip>
                  <TooltipTrigger
                    type="button"
                    aria-label={t("reports.help.title")}
                    className="text-neutral-400 hover:text-neutral-700"
                  >
                    <Info className="size-4" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="body-sm">{t("reports.help.scope")}</p>
                    <p className="body-sm mt-2">{t("reports.help.metrics")}</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <p className="details text-neutral-500">
                {t("reports.results.activeConditions", {
                  count: countConditions(applied.filters),
                  groups: applied.groupIds.length,
                })}
                {result &&
                  ` · ${t("reports.results.generatedAt", { date: formatReportDate(result.capturedAt, language, currentTimezone) })}`}
              </p>
            </div>
            {renderResults()}
          </main>
        </div>
      </TooltipProvider>

      <ReportSaveDialog
        open={isSaveFormOpen}
        name={saveName}
        visibility={saveVisibility}
        canManageShared={Boolean(options?.canManageShared)}
        isUpdate={Boolean(activeConfigurationId)}
        isPending={isSaving || isUpdating}
        onNameChange={setSaveName}
        onVisibilityChange={setSaveVisibility}
        onOpenChange={setIsSaveFormOpen}
        onSave={saveCurrentConfiguration}
      />
    </PageWrapper>
  );
}
