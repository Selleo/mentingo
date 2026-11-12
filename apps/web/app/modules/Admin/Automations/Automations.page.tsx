import { useNavigate } from "@remix-run/react";
import { AUTOMATION_STATUSES, type AutomationStatus } from "@repo/shared";
import { getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { Plus } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { useAutomations } from "~/api/queries/useAutomations";
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
import { Button } from "~/components/ui/button";
import { useUrlTableState } from "~/hooks/useUrlTableState";

import {
  AUTOMATIONS_PAGE_HANDLES,
  AUTOMATIONS_TABLE_ANY_STATUS,
  AUTOMATIONS_TABLE_DEFAULT_PAGE_SIZE,
  AUTOMATIONS_TABLE_FILTER_KEYS,
  AUTOMATIONS_TABLE_FILTER_PARAMS,
} from "./automationsTable.constants";
import { getAutomationsTableColumns } from "./components/AutomationsTable.columns";

const isAutomationStatus = (value: string | undefined): value is AutomationStatus =>
  Object.values(AUTOMATION_STATUSES).some((status) => status === value);

export default function AutomationsContent() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const tableState = useUrlTableState({
    filterKeys: AUTOMATIONS_TABLE_FILTER_KEYS,
    filterValidators: { [AUTOMATIONS_TABLE_FILTER_PARAMS.STATUS]: isAutomationStatus },
    defaultPerPage: AUTOMATIONS_TABLE_DEFAULT_PAGE_SIZE,
  });
  const statusParam = tableState.filters.status;
  const status = isAutomationStatus(statusParam) ? statusParam : undefined;

  const { data, isPending, isFetching, isError } = useAutomations({
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
    { id: AUTOMATIONS_TABLE_ANY_STATUS, label: t("automationView.filters.all") },
    { id: AUTOMATION_STATUSES.ENABLED, label: t("automationView.filters.enabled") },
    { id: AUTOMATION_STATUSES.DISABLED, label: t("automationView.filters.disabled") },
    { id: AUTOMATION_STATUSES.DRAFT, label: t("automationView.filters.drafts") },
    { id: AUTOMATION_STATUSES.ARCHIVED, label: t("automationView.filters.archived") },
  ];

  const setStatus = (nextStatus?: AutomationStatus) =>
    tableState.setFilter(AUTOMATIONS_TABLE_FILTER_PARAMS.STATUS, nextStatus);

  const activeFilters: ActiveTableFilter[] = status
    ? [
        {
          id: AUTOMATIONS_TABLE_FILTER_PARAMS.STATUS,
          label: t("automationView.table.status"),
          value: statusOptions.find(({ id }) => id === status)?.label ?? status,
          onRemove: () => setStatus(undefined),
        },
      ]
    : [];

  const columns = useMemo(
    () => getAutomationsTableColumns({ t, language: i18n.language }),
    [t, i18n.language],
  );

  const table = useReactTable({
    getRowId: (automation) => automation.id,
    data: data?.data ?? [],
    columns,
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
      <PageHeader
        title={t("automationView.title")}
        actions={
          <Button
            variant="primary"
            className="gap-2"
            onClick={() => navigate("/admin/automations/new")}
            data-testid={AUTOMATIONS_PAGE_HANDLES.CREATE_BUTTON}
          >
            <Plus className="size-4" aria-hidden />
            {t("automationView.createAutomation")}
          </Button>
        }
      />

      <DataTableCard>
        <DataTableToolbar
          searchValue={tableState.searchInput}
          onSearchChange={tableState.setSearchInput}
          searchPlaceholder={t("automationView.filters.searchPlaceholder")}
          searchTestId={AUTOMATIONS_PAGE_HANDLES.SEARCH_INPUT}
          activeFilters={activeFilters}
          canResetFilters={tableState.activeFilterCount > 0}
          onResetFilters={tableState.resetFilters}
        >
          <OptionPicker
            label={t("automationView.table.status")}
            placeholder={t("automationView.filters.all")}
            className="w-full sm:w-44"
            options={statusOptions}
            selectedIds={[status ?? AUTOMATIONS_TABLE_ANY_STATUS]}
            testId={AUTOMATIONS_PAGE_HANDLES.STATUS_FILTER}
            optionTestId={({ id }) => AUTOMATIONS_PAGE_HANDLES.statusFilterOption(id)}
            onToggle={({ id }) => setStatus(isAutomationStatus(id) ? id : undefined)}
          />
        </DataTableToolbar>

        <DataTable
          table={table}
          isRefreshing={isFetching && !isPending}
          onRowClick={(row) => navigate(`/admin/automations/${row.original.id}`)}
          testId={AUTOMATIONS_PAGE_HANDLES.TABLE}
          getRowTestId={(automation) => AUTOMATIONS_PAGE_HANDLES.row(automation.id)}
          emptyState={
            isPending ? (
              <p role="status" className="py-12 text-center text-sm text-muted-foreground">
                {t("automations.loading")}
              </p>
            ) : (
              <DataTableEmptyState
                testId={AUTOMATIONS_PAGE_HANDLES.EMPTY_STATE}
                description={
                  tableState.activeFilterCount > 0
                    ? t("automationView.table.emptyFiltered")
                    : t("automationView.table.empty")
                }
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
    </div>
  );
}
