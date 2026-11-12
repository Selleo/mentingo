import { Link, useNavigate } from "@remix-run/react";
import { getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { Plus, Trash } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useBulkDeleteGroups } from "~/api/mutations/admin/useBulkDeleteGroups";
import { useGroupsTableSuspense } from "~/api/queries/admin/useGroupsTable";
import { BulkEditDropdown } from "~/components/BulkEditDropdown/BulkEditDropdown";
import {
  DataTable,
  DataTableCard,
  DataTableEmptyState,
  DataTablePagination,
  DataTableSelectionBar,
  DataTableToolbar,
  useClampedPage,
  useListedRowSelection,
  useRowRangeSelection,
} from "~/components/DataTable";
import { PageHeader } from "~/components/PageHeader/PageHeader";
import { PageWrapper } from "~/components/PageWrapper";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from "~/components/ui/dialog";
import { useUrlTableState } from "~/hooks/useUrlTableState";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";
import { setPageTitle } from "~/utils/setPageTitle";

import { GROUPS_PAGE_HANDLES } from "../../../../e2e/data/groups/handles";

import { getGroupsColumns, GROUPS_TABLE_SORT_FIELDS } from "./groups.columns";

import type { MetaFunction } from "@remix-run/react";
import type { FormEvent, ReactElement } from "react";

export const meta: MetaFunction = ({ matches }) => setPageTitle(matches, "pages.groups");

const Groups = (): ReactElement => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const language = useLanguageStore((state) => state.language);

  const tableState = useUrlTableState({
    filterKeys: [],
    sortFields: GROUPS_TABLE_SORT_FIELDS,
  });
  const { search, sort, page, perPage } = tableState;

  const groupsParams = useMemo(
    () => ({
      ...(search && { keyword: search }),
      ...(sort && { sort }),
      page,
      perPage,
      language,
    }),
    [search, sort, page, perPage, language],
  );

  // Keeps the current rows on screen while groups for the new filters load.
  const deferredGroupsParams = useDeferredValue(groupsParams);
  const isRefreshingGroups = deferredGroupsParams !== groupsParams;

  const {
    data: { data: groups, pagination },
  } = useGroupsTableSuspense(deferredGroupsParams);

  const [rowSelection, setRowSelection] = useListedRowSelection(groups.map(({ id }) => id));
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const rowRangeSelection = useRowRangeSelection();

  useClampedPage({
    page,
    perPage: pagination.perPage,
    totalItems: pagination.totalItems,
    setPage: tableState.setPage,
  });

  const { mutateAsync: deleteGroups } = useBulkDeleteGroups();

  const columns = getGroupsColumns({ rowRangeSelection, t });

  const table = useReactTable({
    getRowId: (row) => row.id,
    data: groups,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    enableMultiSort: false,
    onSortingChange: tableState.setSorting,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting: tableState.sorting,
      rowSelection,
    },
  });

  const selectedGroupIds = table.getSelectedRowModel().rows.map((row) => row.original.id);

  const deleteSelectedGroups = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await deleteGroups(selectedGroupIds);
      setRowSelection({});
    } catch {
      // The mutation shows the error; the selection stays so the user can retry.
    } finally {
      setIsDialogOpen(false);
    }
  };

  return (
    <PageWrapper
      breadcrumbs={[
        {
          title: t("adminGroupsView.breadcrumbs.groups"),
          href: "/admin/groups",
        },
      ]}
    >
      <div data-testid={GROUPS_PAGE_HANDLES.PAGE} className="flex flex-col gap-6">
        <PageHeader
          title={t("navigationSideBar.groups")}
          headingTestId={GROUPS_PAGE_HANDLES.HEADING}
          actions={
            <Link to="new">
              <Button
                data-testid={GROUPS_PAGE_HANDLES.CREATE_BUTTON}
                variant="primary"
                className="gap-2"
              >
                <Plus className="size-4" aria-hidden />
                {t("adminGroupsView.buttons.create")}
              </Button>
            </Link>
          }
        />

        <DataTableCard>
          <DataTableToolbar
            searchValue={tableState.searchInput}
            onSearchChange={tableState.setSearchInput}
            searchPlaceholder={t("common.other.search")}
            searchTestId={GROUPS_PAGE_HANDLES.SEARCH_INPUT}
            canResetFilters={tableState.activeFilterCount > 0}
            onResetFilters={tableState.resetFilters}
          />

          <DataTableSelectionBar selectedCount={selectedGroupIds.length}>
            <BulkEditDropdown
              disabled={selectedGroupIds.length === 0}
              triggerTestId={GROUPS_PAGE_HANDLES.BULK_EDIT_TRIGGER}
              dropdownItems={[
                {
                  icon: <Trash className="size-4 shrink-0" />,
                  translationKey: "adminGroupsView.buttons.deleteSelected",
                  action: () => setIsDialogOpen(true),
                  destructive: true,
                  testId: GROUPS_PAGE_HANDLES.DELETE_SELECTED_BUTTON,
                },
              ]}
            />
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogPortal>
                <DialogOverlay />
                <DialogContent data-testid={GROUPS_PAGE_HANDLES.DELETE_DIALOG}>
                  <DialogTitle>{t("adminGroupsView.deleteGroup.title")}</DialogTitle>
                  <DialogDescription>
                    {t("adminGroupsView.deleteGroup.description")}
                  </DialogDescription>
                  <form onSubmit={deleteSelectedGroups}>
                    <div className="flex justify-end gap-4">
                      <DialogClose asChild>
                        <Button
                          data-testid={GROUPS_PAGE_HANDLES.DELETE_DIALOG_CANCEL_BUTTON}
                          type="reset"
                          variant="ghost"
                        >
                          {t("adminGroupsView.deleteGroup.cancel")}
                        </Button>
                      </DialogClose>
                      <Button
                        data-testid={GROUPS_PAGE_HANDLES.DELETE_DIALOG_CONFIRM_BUTTON}
                        type="submit"
                        variant="secondary"
                      >
                        {t("adminGroupsView.deleteGroup.submit")}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </DialogPortal>
            </Dialog>
          </DataTableSelectionBar>

          <DataTable
            table={table}
            isRefreshing={isRefreshingGroups}
            onRowClick={(row) => navigate(row.original.id)}
            rowRangeSelection={rowRangeSelection}
            testId={GROUPS_PAGE_HANDLES.TABLE}
            bodyTestId={GROUPS_PAGE_HANDLES.TABLE_BODY}
            getRowTestId={(group) => GROUPS_PAGE_HANDLES.row(group.id)}
            emptyState={
              <DataTableEmptyState
                onResetFilters={
                  tableState.activeFilterCount > 0 ? tableState.resetFilters : undefined
                }
              />
            }
          />

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
};

export default Groups;
