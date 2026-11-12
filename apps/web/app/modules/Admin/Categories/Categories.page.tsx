import { Link, useNavigate } from "@remix-run/react";
import { getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { Plus, Trash } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useDeleteCategory } from "~/api/mutations/admin/useDeleteCategory";
import { useDeleteManyCategories } from "~/api/mutations/admin/useDeleteManyCategories";
import { useCategoriesTableSuspense } from "~/api/queries/useCategoriesTable";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { useUrlTableState } from "~/hooks/useUrlTableState";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";
import { setPageTitle } from "~/utils/setPageTitle";

import { CATEGORIES_PAGE_HANDLES } from "../../../../e2e/data/categories/handles";

import { CATEGORIES_TABLE_SORT_FIELDS, getCategoriesColumns } from "./categories.columns";

import type { MetaFunction } from "@remix-run/react";

export const meta: MetaFunction = ({ matches }) => setPageTitle(matches, "pages.categories");

const CATEGORIES_TABLE_SEARCH_PARAM = "title";

const Categories = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const appLanguage = useLanguageStore((state) => state.language);

  const tableState = useUrlTableState({
    searchParam: CATEGORIES_TABLE_SEARCH_PARAM,
    filterKeys: [],
    sortFields: CATEGORIES_TABLE_SORT_FIELDS,
  });
  const { search, sort, page, perPage } = tableState;

  const categoriesParams = useMemo(
    () => ({
      ...(search && { title: search }),
      ...(sort && { sort }),
      page,
      perPage,
      language: appLanguage,
    }),
    [search, sort, page, perPage, appLanguage],
  );

  // Keeps the current rows on screen while categories for the new filters load.
  const deferredCategoriesParams = useDeferredValue(categoriesParams);
  const isRefreshingCategories = deferredCategoriesParams !== categoriesParams;

  const {
    data: { data: categories, pagination },
  } = useCategoriesTableSuspense(deferredCategoriesParams);

  const [rowSelection, setRowSelection] = useListedRowSelection(categories.map(({ id }) => id));
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const rowRangeSelection = useRowRangeSelection();

  useClampedPage({
    page,
    perPage: pagination.perPage,
    totalItems: pagination.totalItems,
    setPage: tableState.setPage,
  });

  const { mutate: deleteCategory } = useDeleteCategory();
  const { mutate: deleteManyCategories } = useDeleteManyCategories();

  const columns = useMemo(
    () => getCategoriesColumns({ rowRangeSelection, t }),
    [rowRangeSelection, t],
  );

  const table = useReactTable({
    getRowId: (row) => row.id,
    data: categories,
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

  const selectedCategories = table.getSelectedRowModel().rows.map((row) => row.original.id);

  const deleteSelectedCategories = () => {
    const [firstSelectedCategory] = selectedCategories;

    if (!firstSelectedCategory) return;

    if (selectedCategories.length === 1 && firstSelectedCategory) {
      deleteCategory(firstSelectedCategory, {
        onSuccess: () => setRowSelection({}),
      });

      return;
    }

    deleteManyCategories(selectedCategories, {
      onSuccess: () => setRowSelection({}),
    });
  };

  const getDeleteModalTitle = () => {
    if (selectedCategories.length === 1) {
      return t("adminCategoriesView.deleteModal.titleSingle");
    }
    return t("adminCategoriesView.deleteModal.titleMultiple");
  };

  const getDeleteModalDescription = () => {
    if (selectedCategories.length === 1) {
      return t("adminCategoriesView.deleteModal.descriptionSingle");
    }
    return t("adminCategoriesView.deleteModal.descriptionMultiple", {
      count: selectedCategories.length,
    });
  };

  return (
    <PageWrapper
      breadcrumbs={[
        { title: t("adminCategoriesView.breadcrumbs.categories"), href: "/admin/categories" },
      ]}
    >
      <div className="flex flex-col gap-6" data-testid={CATEGORIES_PAGE_HANDLES.PAGE}>
        <PageHeader
          title={t("navigationSideBar.categories")}
          headingTestId={CATEGORIES_PAGE_HANDLES.HEADING}
          actions={
            <Link to="new">
              <Button
                variant="primary"
                className="gap-2"
                data-testid={CATEGORIES_PAGE_HANDLES.CREATE_BUTTON}
              >
                <Plus className="size-4" aria-hidden />
                {t("adminCategoriesView.button.createNew")}
              </Button>
            </Link>
          }
        />

        <DataTableCard>
          <DataTableToolbar
            searchValue={tableState.searchInput}
            onSearchChange={tableState.setSearchInput}
            searchPlaceholder={t("adminCategoriesView.filters.placeholder.title")}
            searchTestId={CATEGORIES_PAGE_HANDLES.SEARCH_INPUT}
            canResetFilters={tableState.activeFilterCount > 0}
            onResetFilters={tableState.resetFilters}
          />

          <DataTableSelectionBar selectedCount={selectedCategories.length}>
            <BulkEditDropdown
              disabled={selectedCategories.length === 0}
              triggerTestId={CATEGORIES_PAGE_HANDLES.BULK_EDIT_TRIGGER}
              dropdownItems={[
                {
                  icon: <Trash className="size-4 shrink-0" />,
                  translationKey: "adminCategoriesView.button.deleteSelected",
                  action: () => setIsDeleteDialogOpen(true),
                  destructive: true,
                  testId: CATEGORIES_PAGE_HANDLES.DELETE_SELECTED_BUTTON,
                },
              ]}
            />
            <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
              <DialogContent
                className="max-w-md"
                data-testid={CATEGORIES_PAGE_HANDLES.DELETE_DIALOG}
              >
                <DialogHeader>
                  <DialogTitle>{getDeleteModalTitle()}</DialogTitle>
                  <DialogDescription>{getDeleteModalDescription()}</DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button
                      variant="ghost"
                      className="text-primary-800"
                      data-testid={CATEGORIES_PAGE_HANDLES.DELETE_DIALOG_CANCEL_BUTTON}
                    >
                      {t("common.button.cancel")}
                    </Button>
                  </DialogClose>
                  <DialogClose asChild>
                    <Button
                      onClick={deleteSelectedCategories}
                      variant="destructive"
                      data-testid={CATEGORIES_PAGE_HANDLES.DELETE_DIALOG_CONFIRM_BUTTON}
                    >
                      {t("common.button.delete")}
                    </Button>
                  </DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </DataTableSelectionBar>

          <DataTable
            table={table}
            isRefreshing={isRefreshingCategories}
            onRowClick={(row) => navigate(row.original.id)}
            rowRangeSelection={rowRangeSelection}
            testId={CATEGORIES_PAGE_HANDLES.TABLE}
            bodyTestId={CATEGORIES_PAGE_HANDLES.TABLE_BODY}
            getRowTestId={(category) => CATEGORIES_PAGE_HANDLES.row(category.id)}
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

export default Categories;
