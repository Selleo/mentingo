import { Link, type MetaFunction } from "@remix-run/react";
import { getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { Plus } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { match } from "ts-pattern";

import { useCreateSupportSession } from "~/api/mutations/super-admin/useCreateSupportSession";
import { useDeleteTenant } from "~/api/mutations/super-admin/useDeleteTenant";
import { useTenantsSuspense } from "~/api/queries/super-admin/useTenants";
import {
  type ActiveTableFilter,
  DataTable,
  DataTableCard,
  DataTableEmptyState,
  DataTablePagination,
  DataTableToolbar,
  useClampedPage,
} from "~/components/DataTable";
import { OptionPicker } from "~/components/OptionPicker/OptionPicker";
import { PageHeader } from "~/components/PageHeader/PageHeader";
import { PageWrapper } from "~/components/PageWrapper";
import { Button } from "~/components/ui/button";
import { useUrlTableState } from "~/hooks/useUrlTableState";
import { TenantDeleteDialog } from "~/modules/SuperAdmin/TenantDeleteDialog";
import { getTenantsColumns } from "~/modules/SuperAdmin/tenants.columns";
import { setPageTitle } from "~/utils/setPageTitle";

import { TENANTS_PAGE_HANDLES } from "../../../e2e/data/tenants/handles";

import {
  TENANT_STATUS_FILTERS,
  TENANTS_PATH,
  TENANTS_TABLE_DEFAULT_PAGE_SIZE,
  TENANTS_TABLE_FILTER_PARAMS,
  TENANTS_TABLE_SORT_FIELDS,
  type TenantStatusFilter,
} from "./tenantsTable.constants";

import type { TenantsQueryParams } from "~/api/queries/super-admin/useTenants";
import type { Tenant } from "~/modules/SuperAdmin/tenants.columns";

export const meta: MetaFunction = ({ matches }) => setPageTitle(matches, "pages.tenants");

const TENANTS_TABLE_FILTER_KEYS = [TENANTS_TABLE_FILTER_PARAMS.STATUS] as const;

const isTenantStatusFilter = (value: string | undefined): value is TenantStatusFilter =>
  Object.values(TENANT_STATUS_FILTERS).some((statusFilter) => statusFilter === value);

const toTenantStatusQuery = (statusFilter: TenantStatusFilter): TenantsQueryParams["status"] =>
  match(statusFilter)
    .with(TENANT_STATUS_FILTERS.ACTIVE, () => TENANT_STATUS_FILTERS.ACTIVE)
    .with(TENANT_STATUS_FILTERS.INACTIVE, () => TENANT_STATUS_FILTERS.INACTIVE)
    .with(TENANT_STATUS_FILTERS.ALL, () => undefined)
    .exhaustive();

export default function TenantsPage() {
  const { t, i18n } = useTranslation();
  const [tenantToDelete, setTenantToDelete] = useState<Tenant | null>(null);

  const tableState = useUrlTableState({
    searchParam: TENANTS_TABLE_FILTER_PARAMS.SEARCH,
    filterKeys: TENANTS_TABLE_FILTER_KEYS,
    filterValidators: { [TENANTS_TABLE_FILTER_PARAMS.STATUS]: isTenantStatusFilter },
    sortFields: TENANTS_TABLE_SORT_FIELDS,
    defaultPerPage: TENANTS_TABLE_DEFAULT_PAGE_SIZE,
  });
  const statusParam = tableState.filters.status;
  const statusFilter = isTenantStatusFilter(statusParam)
    ? statusParam
    : TENANT_STATUS_FILTERS.ACTIVE;

  const tenantsParams = useMemo<TenantsQueryParams>(
    () => ({
      page: tableState.page,
      perPage: tableState.perPage,
      ...(tableState.search && { search: tableState.search }),
      ...(tableState.sort && { sort: tableState.sort }),
      status: toTenantStatusQuery(statusFilter),
    }),
    [tableState.page, tableState.perPage, tableState.search, tableState.sort, statusFilter],
  );
  // Keeps the current rows on screen while tenants for the new filters load.
  const deferredTenantsParams = useDeferredValue(tenantsParams);
  const isRefreshingTenants = deferredTenantsParams !== tenantsParams;

  const { data: tenants } = useTenantsSuspense(deferredTenantsParams);
  const { mutateAsync: createSupportSession, isPending: isCreatingSupportSession } =
    useCreateSupportSession();
  const { mutateAsync: deleteTenant, isPending: isDeletingTenant } = useDeleteTenant();

  useClampedPage({
    page: tableState.page,
    perPage: tableState.perPage,
    totalItems: tenants.pagination.totalItems,
    setPage: tableState.setPage,
  });

  const columns = useMemo(
    () =>
      getTenantsColumns(
        t,
        async (tenantId: string, targetUserId: string) => {
          const supportModeResponse = await createSupportSession({ tenantId, targetUserId });
          window.location.assign(supportModeResponse.data.redirectUrl);
        },
        isCreatingSupportSession,
        i18n.language,
        setTenantToDelete,
      ),
    [createSupportSession, i18n.language, isCreatingSupportSession, t],
  );

  const deleteSelectedTenant = async () => {
    if (!tenantToDelete) return;

    await deleteTenant({ id: tenantToDelete.id });
    setTenantToDelete(null);
  };

  const table = useReactTable({
    data: tenants.data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    enableMultiSort: false,
    onSortingChange: tableState.setSorting,
    state: { sorting: tableState.sorting },
  });

  const statusOptions = [
    { id: TENANT_STATUS_FILTERS.ALL, label: t("common.other.allStatuses") },
    { id: TENANT_STATUS_FILTERS.ACTIVE, label: t("superAdminTenantsView.status.active") },
    { id: TENANT_STATUS_FILTERS.INACTIVE, label: t("superAdminTenantsView.status.inactive") },
  ];

  const setStatusFilter = (nextStatusFilter: TenantStatusFilter) =>
    tableState.setFilter(
      TENANTS_TABLE_FILTER_PARAMS.STATUS,
      nextStatusFilter === TENANT_STATUS_FILTERS.ACTIVE ? undefined : nextStatusFilter,
    );

  const activeFilters: ActiveTableFilter[] =
    statusFilter === TENANT_STATUS_FILTERS.ACTIVE
      ? []
      : [
          {
            id: TENANTS_TABLE_FILTER_PARAMS.STATUS,
            label: t("superAdminTenantsView.table.status"),
            value: statusOptions.find(({ id }) => id === statusFilter)?.label ?? statusFilter,
            onRemove: () => setStatusFilter(TENANT_STATUS_FILTERS.ACTIVE),
          },
        ];

  return (
    <PageWrapper breadcrumbs={[{ title: t("superAdminTenantsView.title"), href: TENANTS_PATH }]}>
      <div data-testid={TENANTS_PAGE_HANDLES.PAGE} className="flex flex-col gap-6">
        <PageHeader
          title={t("superAdminTenantsView.title")}
          headingTestId={TENANTS_PAGE_HANDLES.HEADING}
          actions={
            <Button asChild className="gap-2">
              <Link data-testid={TENANTS_PAGE_HANDLES.CREATE_BUTTON} to={`${TENANTS_PATH}/new`}>
                <Plus className="size-4" aria-hidden="true" />
                {t("superAdminTenantsView.actions.create")}
              </Link>
            </Button>
          }
        />

        <DataTableCard>
          <DataTableToolbar
            searchValue={tableState.searchInput}
            onSearchChange={tableState.setSearchInput}
            searchPlaceholder={t("superAdminTenantsView.search.placeholder")}
            searchTestId={TENANTS_PAGE_HANDLES.SEARCH_INPUT}
            activeFilters={activeFilters}
            canResetFilters={tableState.activeFilterCount > 0}
            onResetFilters={tableState.resetFilters}
          >
            <OptionPicker
              label={t("superAdminTenantsView.table.status")}
              placeholder={t("superAdminTenantsView.status.active")}
              className="w-full sm:w-44"
              options={statusOptions}
              selectedIds={[statusFilter]}
              testId={TENANTS_PAGE_HANDLES.STATUS_FILTER}
              optionTestId={({ id }) =>
                TENANTS_PAGE_HANDLES.statusFilterOption(
                  isTenantStatusFilter(id) ? id : TENANT_STATUS_FILTERS.ACTIVE,
                )
              }
              onToggle={({ id }) => {
                if (isTenantStatusFilter(id)) setStatusFilter(id);
              }}
            />
          </DataTableToolbar>

          <div data-testid={TENANTS_PAGE_HANDLES.TABLE_CONTAINER} aria-busy={isRefreshingTenants}>
            <DataTable
              table={table}
              isRefreshing={isRefreshingTenants}
              testId={TENANTS_PAGE_HANDLES.TABLE}
              bodyTestId={TENANTS_PAGE_HANDLES.TABLE_BODY}
              getRowTestId={(tenant) => TENANTS_PAGE_HANDLES.row(tenant.id)}
              emptyState={
                <DataTableEmptyState
                  title={t("superAdminTenantsView.table.empty")}
                  onResetFilters={
                    tableState.activeFilterCount > 0 ? tableState.resetFilters : undefined
                  }
                />
              }
            />
          </div>

          <DataTablePagination
            totalItems={tenants.pagination.totalItems}
            itemsPerPage={tableState.perPage}
            currentPage={tableState.page}
            onPageChange={tableState.setPage}
            onItemsPerPageChange={tableState.setPerPage}
          />
        </DataTableCard>
      </div>
      <TenantDeleteDialog
        tenantName={tenantToDelete?.name ?? ""}
        open={tenantToDelete !== null}
        isDeleting={isDeletingTenant}
        onOpenChange={(open) => {
          if (!open) setTenantToDelete(null);
        }}
        onConfirm={deleteSelectedTenant}
      />
    </PageWrapper>
  );
}
