import { AUTOMATION_RUN_STATUSES, type AutomationRunStatus } from "@repo/shared";
import { getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useAutomationRuns } from "~/api/queries/useAutomationRuns";
import {
  type ActiveTableFilter,
  DataTable,
  DataTableCard,
  DataTableEmptyState,
  DataTablePagination,
  DataTableToolbar,
  useClampedPage,
} from "~/components/DataTable";
import ErrorPage from "~/components/ErrorPage/ErrorPage";
import { OptionPicker } from "~/components/OptionPicker/OptionPicker";
import { PageHeader } from "~/components/PageHeader/PageHeader";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { useUrlTableState } from "~/hooks/useUrlTableState";

import {
  AUTOMATION_LOGS_PAGE_HANDLES,
  AUTOMATIONS_TABLE_ANY_STATUS,
  AUTOMATIONS_TABLE_DEFAULT_PAGE_SIZE,
  AUTOMATIONS_TABLE_FILTER_KEYS,
  AUTOMATIONS_TABLE_FILTER_PARAMS,
} from "./automationsTable.constants";
import { AutomationRunDetail } from "./Runs/components/AutomationRunDetail";
import { getAutomationRunsTableColumns } from "./Runs/components/AutomationRunsTable.columns";

const isAutomationRunStatus = (value: string | undefined): value is AutomationRunStatus =>
  Object.values(AUTOMATION_RUN_STATUSES).some((status) => status === value);

export default function AutomationLogsContent() {
  const { t, i18n } = useTranslation();
  const [selectedAutomationRunId, setSelectedAutomationRunId] = useState<string | null>(null);

  const tableState = useUrlTableState({
    filterKeys: AUTOMATIONS_TABLE_FILTER_KEYS,
    filterValidators: { [AUTOMATIONS_TABLE_FILTER_PARAMS.STATUS]: isAutomationRunStatus },
    defaultPerPage: AUTOMATIONS_TABLE_DEFAULT_PAGE_SIZE,
  });
  const statusParam = tableState.filters.status;
  const status = isAutomationRunStatus(statusParam) ? statusParam : undefined;

  const { data, isPending, isFetching, isError } = useAutomationRuns({
    page: tableState.page,
    perPage: tableState.perPage,
    search: tableState.search,
    status,
  });

  useClampedPage({
    page: tableState.page,
    perPage: tableState.perPage,
    totalItems: data?.pagination.totalItems,
    setPage: tableState.setPage,
  });

  const statusOptions = [
    { id: AUTOMATIONS_TABLE_ANY_STATUS, label: t("automations.allStatuses") },
    ...Object.values(AUTOMATION_RUN_STATUSES).map((runStatus) => ({
      id: runStatus,
      label: t(`automations.executionStatuses.${runStatus}`),
    })),
  ];

  const setStatus = (nextStatus?: AutomationRunStatus) =>
    tableState.setFilter(AUTOMATIONS_TABLE_FILTER_PARAMS.STATUS, nextStatus);

  const activeFilters: ActiveTableFilter[] = status
    ? [
        {
          id: AUTOMATIONS_TABLE_FILTER_PARAMS.STATUS,
          label: t("automationLogs.table.status"),
          value: statusOptions.find(({ id }) => id === status)?.label ?? status,
          onRemove: () => setStatus(undefined),
        },
      ]
    : [];

  const table = useReactTable({
    getRowId: (automationRun) => automationRun.id,
    data: data?.data ?? [],
    columns: getAutomationRunsTableColumns({
      t,
      language: i18n.language,
      onOpenDetail: setSelectedAutomationRunId,
    }),
    getCoreRowModel: getCoreRowModel(),
  });

  if (isError)
    return (
      <ErrorPage
        title={t("automations.requestFailed")}
        actionLabel={t("common.refreshPage")}
        onAction={() => window.location.reload()}
        className="min-h-[50vh]"
      />
    );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("automationLogs.title")} />

      <DataTableCard>
        <DataTableToolbar
          searchValue={tableState.searchInput}
          onSearchChange={tableState.setSearchInput}
          searchPlaceholder={t("automationLogs.filters.searchPlaceholder")}
          searchTestId={AUTOMATION_LOGS_PAGE_HANDLES.SEARCH_INPUT}
          activeFilters={activeFilters}
          canResetFilters={tableState.activeFilterCount > 0}
          onResetFilters={tableState.resetFilters}
        >
          <OptionPicker
            label={t("automationLogs.table.status")}
            placeholder={t("automations.allStatuses")}
            className="w-full sm:w-44"
            options={statusOptions}
            selectedIds={[status ?? AUTOMATIONS_TABLE_ANY_STATUS]}
            testId={AUTOMATION_LOGS_PAGE_HANDLES.STATUS_FILTER}
            optionTestId={({ id }) => AUTOMATION_LOGS_PAGE_HANDLES.statusFilterOption(id)}
            onToggle={({ id }) => setStatus(isAutomationRunStatus(id) ? id : undefined)}
          />
        </DataTableToolbar>

        <DataTable
          table={table}
          isRefreshing={isFetching && !isPending}
          onRowClick={(row) => setSelectedAutomationRunId(row.original.id)}
          testId={AUTOMATION_LOGS_PAGE_HANDLES.TABLE}
          getRowTestId={(automationRun) => AUTOMATION_LOGS_PAGE_HANDLES.row(automationRun.id)}
          emptyState={
            isPending ? (
              <p role="status" className="py-12 text-center text-sm text-muted-foreground">
                {t("automations.loading")}
              </p>
            ) : (
              <DataTableEmptyState
                testId={AUTOMATION_LOGS_PAGE_HANDLES.EMPTY_STATE}
                title={t("automationLogs.table.empty")}
                onResetFilters={
                  tableState.activeFilterCount > 0 ? tableState.resetFilters : undefined
                }
              />
            )
          }
        />

        <DataTablePagination
          totalItems={data?.pagination.totalItems}
          itemsPerPage={tableState.perPage}
          currentPage={tableState.page}
          onPageChange={tableState.setPage}
          onItemsPerPageChange={tableState.setPerPage}
        />
      </DataTableCard>

      <Dialog
        open={Boolean(selectedAutomationRunId)}
        onOpenChange={(open) => {
          if (!open) setSelectedAutomationRunId(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("automationLogs.detail.title")}</DialogTitle>
            <DialogDescription>{t("automationLogs.detail.description")}</DialogDescription>
          </DialogHeader>
          {selectedAutomationRunId && (
            <AutomationRunDetail automationRunId={selectedAutomationRunId} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
