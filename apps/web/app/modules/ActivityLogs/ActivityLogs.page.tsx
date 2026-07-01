import {
  ACTIVITY_LOG_ACTION_TYPES,
  ACTIVITY_LOG_RESOURCE_ACTION_TYPES,
  ACTIVITY_LOG_RESOURCE_TYPES,
  type ActivityLogActionType,
  type ActivityLogResourceType,
} from "@repo/shared";
import { flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { parseISO } from "date-fns";
import { enUS, pl } from "date-fns/locale";
import { debounce } from "lodash-es";
import { Search } from "lucide-react";
import { useCallback, useMemo, useState, useTransition } from "react";
import { useTranslation } from "react-i18next";

import { useActivityLogsQuerySuspense } from "~/api/queries/admin/useActivityLogs";
import { PageWrapper } from "~/components/PageWrapper";
import { Pagination } from "~/components/Pagination/Pagination";
import { Input } from "~/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { getActivityLogsColumns } from "~/modules/ActivityLogs/activityLogs.columns";
import { ActivityLogAccordionRow } from "~/modules/ActivityLogs/components/ActivityLogAccordionRow";
import { ActivityLogActionMultiSelect } from "~/modules/ActivityLogs/components/ActivityLogActionMultiSelect";
import { ActivityLogDateFilter } from "~/modules/ActivityLogs/components/ActivityLogDateFilter";
import { ActivityLogSingleSelect } from "~/modules/ActivityLogs/components/ActivityLogSingleSelect";
import { setPageTitle } from "~/utils/setPageTitle";

import type { MetaFunction } from "@remix-run/react";
import type { ITEMS_PER_PAGE_OPTIONS } from "~/components/Pagination/Pagination";

type ActivityLogsSearchState = {
  keyword?: string;
  actionTypes?: ActivityLogActionType[];
  resourceType?: ActivityLogResourceType;
  from?: string;
  to?: string;
  page?: number;
  perPage?: (typeof ITEMS_PER_PAGE_OPTIONS)[number];
};

export const meta: MetaFunction = ({ matches }) => setPageTitle(matches, "pages.activityLogs");

export default function ActivityLogsPage() {
  const { t, i18n } = useTranslation();
  const [isPending, startTransition] = useTransition();

  const [searchParams, setSearchParams] = useState<ActivityLogsSearchState>({
    keyword: undefined,
    actionTypes: undefined,
    resourceType: undefined,
    from: undefined,
    to: undefined,
    page: 1,
    perPage: 10,
  });
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  const calendarLocale = i18n.language.startsWith("pl") ? pl : enUS;

  const updateSearchParams = useCallback(
    (updates: Partial<ActivityLogsSearchState>, resetPage = true) => {
      setExpandedRowId(null);

      startTransition(() => {
        setSearchParams((prev) => ({
          ...prev,
          ...(resetPage ? { page: 1 } : {}),
          ...updates,
        }));
      });
    },
    [startTransition],
  );

  const handleResourceChange = useCallback(
    (resourceType: ActivityLogResourceType | undefined) => {
      setExpandedRowId(null);

      startTransition(() => {
        setSearchParams((prev) => {
          const allowedActions = resourceType
            ? new Set<ActivityLogActionType>(ACTIVITY_LOG_RESOURCE_ACTION_TYPES[resourceType])
            : undefined;
          const actionTypes = allowedActions
            ? prev.actionTypes?.filter((actionType) => allowedActions.has(actionType))
            : prev.actionTypes;

          return {
            ...prev,
            page: 1,
            resourceType,
            actionTypes: actionTypes?.length ? actionTypes : undefined,
          };
        });
      });
    },
    [startTransition],
  );

  const debouncedKeywordChange = useMemo(
    () =>
      debounce((keyword: string) => {
        updateSearchParams({ keyword: keyword || undefined });
      }, 300),
    [updateSearchParams],
  );

  const handleRowToggle = useCallback((rowId: string) => {
    setExpandedRowId((current) => (current === rowId ? null : rowId));
  }, []);

  const fromDate = useMemo(() => {
    if (!searchParams.from) return undefined;

    const parsedDate = parseISO(searchParams.from);

    return Number.isNaN(parsedDate.getTime()) ? undefined : parsedDate;
  }, [searchParams.from]);

  const toDate = useMemo(() => {
    if (!searchParams.to) return undefined;

    const parsedDate = parseISO(searchParams.to);

    return Number.isNaN(parsedDate.getTime()) ? undefined : parsedDate;
  }, [searchParams.to]);

  const activityLogsQueryParams = useMemo(
    () => ({
      page: searchParams.page,
      perPage: searchParams.perPage,
      ...(searchParams.keyword ? { keyword: searchParams.keyword } : {}),
      ...(searchParams.actionTypes?.length ? { actionTypes: searchParams.actionTypes } : {}),
      ...(searchParams.resourceType ? { resourceType: searchParams.resourceType } : {}),
      ...(searchParams.from ? { from: searchParams.from } : {}),
      ...(searchParams.to ? { to: searchParams.to } : {}),
    }),
    [searchParams],
  );

  const { data: activityLogsData, isLoading } =
    useActivityLogsQuerySuspense(activityLogsQueryParams);

  const breadcrumbs = [
    { title: t("activityLogsView.breadcrumbs.activityLogs"), href: "/admin/activity-logs" },
  ];

  const { data, pagination } = activityLogsData ?? {};
  const { totalItems, perPage: pageSize, page: currentPage } = pagination ?? {};

  const activityLogs = data ?? [];

  const columns = useMemo(
    () =>
      getActivityLogsColumns(t, {
        expandedRowId,
        onToggleRow: handleRowToggle,
      }),
    [expandedRowId, handleRowToggle, t],
  );
  const actionOptions = useMemo(
    () =>
      Object.values(ACTIVITY_LOG_ACTION_TYPES).map((actionType) => ({
        value: actionType,
        label: t(`activityLogsView.actions.${actionType}`, { defaultValue: actionType }),
      })),
    [t],
  );
  const scopedActionOptions = useMemo(() => {
    if (!searchParams.resourceType) return actionOptions;

    const allowedActions = new Set<ActivityLogActionType>(
      ACTIVITY_LOG_RESOURCE_ACTION_TYPES[searchParams.resourceType],
    );

    return actionOptions.filter((option) => allowedActions.has(option.value));
  }, [actionOptions, searchParams.resourceType]);
  const resourceOptions = useMemo(
    () =>
      Object.values(ACTIVITY_LOG_RESOURCE_TYPES).map((resourceType) => ({
        value: resourceType,
        label: t(`activityLogsView.entity.${resourceType}`, { defaultValue: resourceType }),
      })),
    [t],
  );

  const table = useReactTable({
    data: activityLogs,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
  });

  return (
    <PageWrapper breadcrumbs={breadcrumbs} className="bg-neutral-50/50">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="h4">{t("navigationSideBar.activityLogs")}</h1>
          <p className="max-w-2xl text-sm text-neutral-600">{t("activityLogsView.description")}</p>
        </div>

        <div>
          <div className="flex grow flex-wrap items-center gap-2 py-6">
            <div className="relative max-w-2xl flex-grow">
              <Search className="absolute left-2 top-1/2 size-5 -translate-y-1/2 transform text-neutral-800" />
              <Input
                type="text"
                placeholder={t("activityLogsView.filters.placeholder.search")}
                className="w-full max-w-[320px] border border-neutral-300 py-2 pl-8 pr-4 md:max-w-none"
                defaultValue={searchParams.keyword}
                onChange={(event) => debouncedKeywordChange(event.target.value)}
              />
            </div>
            <ActivityLogSingleSelect
              value={searchParams.resourceType}
              options={resourceOptions}
              placeholder={t("activityLogsView.filters.placeholder.resource")}
              searchPlaceholder={t("activityLogsView.filters.search.resource")}
              emptyLabel={t("activityLogsView.filters.empty.resource")}
              allLabel={t("activityLogsView.filters.placeholder.resource")}
              onChange={handleResourceChange}
            />
            <ActivityLogActionMultiSelect
              values={searchParams.actionTypes ?? []}
              options={scopedActionOptions}
              placeholder={t("activityLogsView.filters.placeholder.action")}
              selectedCountLabel={t("activityLogsView.filters.selectedActions", {
                count: searchParams.actionTypes?.length ?? 0,
              })}
              searchPlaceholder={t("activityLogsView.filters.search.action")}
              emptyLabel={t("activityLogsView.filters.empty.action")}
              allLabel={t("activityLogsView.filters.placeholder.action")}
              onChange={(actionTypes) =>
                updateSearchParams({ actionTypes: actionTypes.length ? actionTypes : undefined })
              }
            />
            <ActivityLogDateFilter
              value={searchParams.from}
              placeholder={t("activityLogsView.filters.placeholder.from")}
              calendarLocale={calendarLocale}
              maxDate={toDate}
              onChange={(from) => updateSearchParams({ from })}
            />
            <ActivityLogDateFilter
              value={searchParams.to}
              placeholder={t("activityLogsView.filters.placeholder.to")}
              calendarLocale={calendarLocale}
              minDate={fromDate}
              onChange={(to) => updateSearchParams({ to })}
            />
            {isPending && <span className="sr-only">{t("activityLogsView.table.loading")}</span>}
          </div>
          <Table className="border bg-neutral-50">
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header, index) => (
                    <TableHead
                      key={header.id}
                      className={index === headerGroup.headers.length - 1 ? "w-12 text-right" : ""}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={columns.length} className="text-center text-muted-foreground">
                    {t("activityLogsView.table.loading")}
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && table.getRowModel().rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={columns.length} className="text-center text-muted-foreground">
                    {t("activityLogsView.table.empty")}
                  </TableCell>
                </TableRow>
              )}
              {table.getRowModel().rows.map((row) => (
                <ActivityLogAccordionRow
                  key={row.id}
                  row={row}
                  columnsLength={columns.length}
                  isExpanded={expandedRowId === row.id}
                />
              ))}
            </TableBody>
          </Table>
          {!isLoading && (totalItems ?? 0) > 0 && (
            <Pagination
              className="border-b border-x bg-neutral-50 rounded-b-lg"
              emptyDataClassName="border-b border-x bg-neutral-50 rounded-b-lg"
              totalItems={totalItems}
              itemsPerPage={pageSize as (typeof ITEMS_PER_PAGE_OPTIONS)[number]}
              currentPage={currentPage ?? searchParams.page ?? 1}
              onPageChange={(newPage) => updateSearchParams({ page: newPage }, false)}
              onItemsPerPageChange={(newPerPage) => {
                updateSearchParams({
                  page: 1,
                  perPage: Number(newPerPage) as (typeof ITEMS_PER_PAGE_OPTIONS)[number],
                });
              }}
            />
          )}
        </div>
      </div>
    </PageWrapper>
  );
}
