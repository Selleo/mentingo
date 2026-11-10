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
import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useActivityLogsQuerySuspense } from "~/api/queries/admin/useActivityLogs";
import {
  type ActiveTableFilter,
  DataTableCard,
  DataTableEmptyState,
  DataTablePagination,
  DataTableToolbar,
  useClampedPage,
} from "~/components/DataTable";
import { OptionPicker } from "~/components/OptionPicker/OptionPicker";
import { PageHeader } from "~/components/PageHeader/PageHeader";
import { PageWrapper } from "~/components/PageWrapper";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { useUrlTableState } from "~/hooks/useUrlTableState";
import { cn } from "~/lib/utils";
import { getActivityLogsColumns } from "~/modules/ActivityLogs/activityLogs.columns";
import {
  getDateLabel,
  getSelectedActionLabel,
  getSelectedOptionLabel,
} from "~/modules/ActivityLogs/activityLogs.filters";
import { ActivityLogAccordionRow } from "~/modules/ActivityLogs/components/ActivityLogAccordionRow";
import { ActivityLogDateFilter } from "~/modules/ActivityLogs/components/ActivityLogDateFilter";
import { setPageTitle } from "~/utils/setPageTitle";

import type { MetaFunction } from "@remix-run/react";

const ACTIVITY_LOGS_FILTER_PARAMS = {
  RESOURCE: "resource",
  ACTIONS: "actions",
  FROM: "from",
  TO: "to",
} as const;

const ACTIVITY_LOGS_FILTER_KEYS = Object.values(ACTIVITY_LOGS_FILTER_PARAMS);

const ACTIVITY_LOGS_DEFAULT_PER_PAGE = 10;
const ACTION_TYPES_SEPARATOR = ",";
const ANY_RESOURCE_VALUE = "__all__";

const isActivityLogResourceType = (value: string | undefined): value is ActivityLogResourceType =>
  Object.values(ACTIVITY_LOG_RESOURCE_TYPES).some((resourceType) => resourceType === value);

const isActivityLogActionType = (value: string): value is ActivityLogActionType =>
  Object.values(ACTIVITY_LOG_ACTION_TYPES).some((actionType) => actionType === value);

const parseActionTypes = (value: string | undefined) =>
  (value?.split(ACTION_TYPES_SEPARATOR) ?? []).filter(isActivityLogActionType);

const parseDate = (value: string | undefined) => {
  if (!value) return undefined;

  const parsedDate = parseISO(value);

  return Number.isNaN(parsedDate.getTime()) ? undefined : parsedDate;
};

/** Keeps only the actions that exist for the chosen resource. */
const scopeActionTypes = (
  actionTypes: ActivityLogActionType[],
  resourceType: ActivityLogResourceType | undefined,
) => {
  if (!resourceType) return actionTypes;

  const allowedActions = new Set<ActivityLogActionType>(
    ACTIVITY_LOG_RESOURCE_ACTION_TYPES[resourceType],
  );

  return actionTypes.filter((actionType) => allowedActions.has(actionType));
};

export const meta: MetaFunction = ({ matches }) => setPageTitle(matches, "pages.activityLogs");

export default function ActivityLogsPage() {
  const { t, i18n } = useTranslation();
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  const tableState = useUrlTableState({
    filterKeys: ACTIVITY_LOGS_FILTER_KEYS,
    defaultPerPage: ACTIVITY_LOGS_DEFAULT_PER_PAGE,
  });
  const { search, filters, page, perPage } = tableState;

  const calendarLocale = i18n.language.startsWith("pl") ? pl : enUS;

  const resourceType = isActivityLogResourceType(filters.resource) ? filters.resource : undefined;
  const actionTypes = useMemo(
    () => scopeActionTypes(parseActionTypes(filters.actions), resourceType),
    [filters.actions, resourceType],
  );
  const fromDate = parseDate(filters.from);
  const toDate = parseDate(filters.to);

  const activityLogsQueryParams = useMemo(
    () => ({
      page,
      perPage,
      ...(search && { keyword: search }),
      ...(actionTypes.length && { actionTypes }),
      ...(resourceType && { resourceType }),
      ...(filters.from && { from: filters.from }),
      ...(filters.to && { to: filters.to }),
    }),
    [page, perPage, search, actionTypes, resourceType, filters.from, filters.to],
  );

  // Keeps the current rows on screen while logs for the new filters load.
  const deferredQueryParams = useDeferredValue(activityLogsQueryParams);
  const isRefreshingLogs = deferredQueryParams !== activityLogsQueryParams;

  const {
    data: { data: activityLogs, pagination },
  } = useActivityLogsQuerySuspense(deferredQueryParams);

  useEffect(() => {
    setExpandedRowId(null);
  }, [activityLogsQueryParams]);

  useClampedPage({
    page,
    perPage: pagination.perPage,
    totalItems: pagination.totalItems,
    setPage: tableState.setPage,
  });

  const handleRowToggle = useCallback((rowId: string) => {
    setExpandedRowId((current) => (current === rowId ? null : rowId));
  }, []);

  const columns = useMemo(
    () => getActivityLogsColumns(t, { expandedRowId, onToggleRow: handleRowToggle }),
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
    const allowedActionTypes = new Set(
      scopeActionTypes(
        actionOptions.map(({ value }) => value),
        resourceType,
      ),
    );

    return actionOptions.filter(({ value }) => allowedActionTypes.has(value));
  }, [actionOptions, resourceType]);
  const resourceOptions = useMemo(
    () =>
      Object.values(ACTIVITY_LOG_RESOURCE_TYPES).map((resource) => ({
        value: resource,
        label: t(`activityLogsView.entity.${resource}`, { defaultValue: resource }),
      })),
    [t],
  );

  const actionPlaceholder = t("activityLogsView.filters.placeholder.action");
  const resourcePlaceholder = t("activityLogsView.filters.placeholder.resource");
  const fromPlaceholder = t("activityLogsView.filters.placeholder.from");
  const toPlaceholder = t("activityLogsView.filters.placeholder.to");
  const actionsLabel = getSelectedActionLabel(
    actionOptions,
    actionTypes,
    actionPlaceholder,
    t("activityLogsView.filters.selectedActions", { count: actionTypes.length }),
  );

  const setResourceType = (nextResourceType: ActivityLogResourceType | undefined) => {
    const nextActionTypes = scopeActionTypes(actionTypes, nextResourceType);

    tableState.setFilters({
      [ACTIVITY_LOGS_FILTER_PARAMS.RESOURCE]: nextResourceType,
      [ACTIVITY_LOGS_FILTER_PARAMS.ACTIONS]: nextActionTypes.join(ACTION_TYPES_SEPARATOR),
    });
  };

  const toggleActionType = (actionType: ActivityLogActionType) => {
    const nextActionTypes = actionTypes.includes(actionType)
      ? actionTypes.filter((selectedActionType) => selectedActionType !== actionType)
      : [...actionTypes, actionType];

    tableState.setFilter(
      ACTIVITY_LOGS_FILTER_PARAMS.ACTIONS,
      nextActionTypes.join(ACTION_TYPES_SEPARATOR),
    );
  };

  const activeFilters: ActiveTableFilter[] = [
    ...(resourceType
      ? [
          {
            id: ACTIVITY_LOGS_FILTER_PARAMS.RESOURCE,
            label: resourcePlaceholder,
            value: getSelectedOptionLabel(resourceOptions, resourceType) ?? resourceType,
            onRemove: () => setResourceType(undefined),
          },
        ]
      : []),
    ...(actionTypes.length
      ? [
          {
            id: ACTIVITY_LOGS_FILTER_PARAMS.ACTIONS,
            label: actionPlaceholder,
            value: actionsLabel,
            onRemove: () => tableState.setFilter(ACTIVITY_LOGS_FILTER_PARAMS.ACTIONS, undefined),
          },
        ]
      : []),
    ...(fromDate
      ? [
          {
            id: ACTIVITY_LOGS_FILTER_PARAMS.FROM,
            label: fromPlaceholder,
            value: getDateLabel(filters.from, fromPlaceholder, calendarLocale),
            onRemove: () => tableState.setFilter(ACTIVITY_LOGS_FILTER_PARAMS.FROM, undefined),
          },
        ]
      : []),
    ...(toDate
      ? [
          {
            id: ACTIVITY_LOGS_FILTER_PARAMS.TO,
            label: toPlaceholder,
            value: getDateLabel(filters.to, toPlaceholder, calendarLocale),
            onRemove: () => tableState.setFilter(ACTIVITY_LOGS_FILTER_PARAMS.TO, undefined),
          },
        ]
      : []),
  ];

  const table = useReactTable({
    data: activityLogs,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
  });
  const rows = table.getRowModel().rows;

  const breadcrumbs = [
    { title: t("activityLogsView.breadcrumbs.activityLogs"), href: "/admin/activity-logs" },
  ];

  return (
    <PageWrapper breadcrumbs={breadcrumbs}>
      <div className="flex flex-col gap-6">
        <PageHeader title={t("navigationSideBar.activityLogs")} />

        <DataTableCard>
          <DataTableToolbar
            searchValue={tableState.searchInput}
            onSearchChange={tableState.setSearchInput}
            searchPlaceholder={t("activityLogsView.filters.placeholder.search")}
            activeFilters={activeFilters}
            canResetFilters={tableState.activeFilterCount > 0}
            onResetFilters={tableState.resetFilters}
          >
            <OptionPicker
              label={resourcePlaceholder}
              placeholder={resourcePlaceholder}
              className="w-full sm:w-52"
              options={[
                { id: ANY_RESOURCE_VALUE, label: resourcePlaceholder },
                ...resourceOptions.map(({ value, label }) => ({ id: value, label })),
              ]}
              selectedIds={[resourceType ?? ANY_RESOURCE_VALUE]}
              onToggle={({ id }) => setResourceType(isActivityLogResourceType(id) ? id : undefined)}
            />
            <OptionPicker
              label={actionPlaceholder}
              placeholder={actionPlaceholder}
              selectedLabel={actionTypes.length ? actionsLabel : undefined}
              className="w-full sm:w-52"
              multiple
              options={scopedActionOptions.map(({ value, label }) => ({ id: value, label }))}
              selectedIds={actionTypes}
              onToggle={({ id }) => {
                if (isActivityLogActionType(id)) toggleActionType(id);
              }}
            />
            <ActivityLogDateFilter
              value={filters.from}
              placeholder={fromPlaceholder}
              calendarLocale={calendarLocale}
              maxDate={toDate}
              onChange={(from) => tableState.setFilter(ACTIVITY_LOGS_FILTER_PARAMS.FROM, from)}
            />
            <ActivityLogDateFilter
              value={filters.to}
              placeholder={toPlaceholder}
              calendarLocale={calendarLocale}
              minDate={fromDate}
              onChange={(to) => tableState.setFilter(ACTIVITY_LOGS_FILTER_PARAMS.TO, to)}
            />
          </DataTableToolbar>

          {/* Rows expand into details, so the logs keep their own accordion body. */}
          <div
            aria-busy={isRefreshingLogs}
            className={cn(
              "border-t border-neutral-200 transition-opacity",
              isRefreshingLogs && "opacity-60",
            )}
          >
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id} className="hover:bg-transparent">
                    {headerGroup.headers.map((header, index) => (
                      <TableHead
                        key={header.id}
                        className={cn(
                          index === headerGroup.headers.length - 1 && "w-12 text-right",
                        )}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <ActivityLogAccordionRow
                    key={row.id}
                    row={row}
                    columnsLength={columns.length}
                    isExpanded={expandedRowId === row.id}
                  />
                ))}
                {rows.length === 0 && (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={columns.length}>
                      <DataTableEmptyState
                        title={t("activityLogsView.table.empty")}
                        onResetFilters={
                          tableState.activeFilterCount > 0 ? tableState.resetFilters : undefined
                        }
                      />
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <DataTablePagination
            totalItems={pagination.totalItems}
            itemsPerPage={perPage}
            currentPage={page}
            onPageChange={tableState.setPage}
            onItemsPerPageChange={tableState.setPerPage}
          />
        </DataTableCard>
      </div>
    </PageWrapper>
  );
}
