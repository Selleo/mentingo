import { Link, useNavigate } from "@remix-run/react";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type RowSelectionState,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { isEmpty } from "lodash-es";
import { Plus, Trash } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { useTranslation } from "react-i18next";

import { useDeleteCategory } from "~/api/mutations/admin/useDeleteCategory";
import { useDeleteManyCategories } from "~/api/mutations/admin/useDeleteManyCategories";
import { useCategoriesSuspense, usersQueryOptions } from "~/api/queries";
import { queryClient } from "~/api/queryClient";
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
  DialogTrigger,
} from "~/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { cn } from "~/lib/utils";
import {
  type FilterConfig,
  type FilterValue,
  SearchFilter,
} from "~/modules/common/SearchFilter/SearchFilter";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";
import { setPageTitle } from "~/utils/setPageTitle";

import { CATEGORIES_PAGE_HANDLES } from "../../../../e2e/data/categories/handles";

import { getCategoriesColumns } from "./categories.columns";

import type { MetaFunction } from "@remix-run/react";

export const meta: MetaFunction = ({ matches }) => setPageTitle(matches, "pages.categories");

export const clientLoader = async () => {
  await queryClient.prefetchQuery(usersQueryOptions());

  return null;
};

const Categories = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [isPending, startTransition] = useTransition();

  const appLanguage = useLanguageStore((state) => state.language);

  const [searchParams, setSearchParams] = useState<{
    title?: string;
    archived?: boolean;
  }>({ archived: false });

  const { data } = useCategoriesSuspense({ ...searchParams, language: appLanguage });

  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [lastSelectedRowIndex, setLastSelectedRowIndex] = useState<number>(0);

  const { mutate: deleteCategory } = useDeleteCategory();
  const { mutate: deleteManyCategories } = useDeleteManyCategories();

  const filterConfig: FilterConfig[] = [
    {
      name: "title",
      type: "text",
      placeholder: t("adminCategoriesView.filters.placeholder.title"),
      testId: CATEGORIES_PAGE_HANDLES.SEARCH_INPUT,
    },
    {
      name: "archived",
      type: "status",
      testId: CATEGORIES_PAGE_HANDLES.STATUS_FILTER,
      optionTestId: (option) =>
        CATEGORIES_PAGE_HANDLES.statusFilterOption(option.value as "all" | "active" | "archived"),
    },
  ];

  const handleFilterChange = (name: string, value: FilterValue) => {
    startTransition(() => {
      setSearchParams((prev) => ({
        ...prev,
        [name]: value,
      }));
    });
  };

  const columns = useMemo(
    () =>
      getCategoriesColumns({
        lastSelectedRowIndex,
        setLastSelectedRowIndex,
        t,
      }),
    [lastSelectedRowIndex, t],
  );

  const table = useReactTable({
    getRowId: (row) => row.id,
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      rowSelection,
    },
  });

  const selectedCategories = table.getSelectedRowModel().rows.map((row) => row.original.id);

  const handleDelete = () => {
    if (selectedCategories.length === 1) {
      deleteCategory(selectedCategories[0], {
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

  const handleRowClick = (userId: string) => {
    navigate(userId);
  };

  return (
    <PageWrapper
      breadcrumbs={[
        { title: t("adminCategoriesView.breadcrumbs.categories"), href: "/admin/categories" },
      ]}
    >
      <div className="flex flex-col" data-testid={CATEGORIES_PAGE_HANDLES.PAGE}>
        <div className="flex flex-wrap justify-between gap-3">
          <h4 className="h4" data-testid={CATEGORIES_PAGE_HANDLES.HEADING}>
            {t("navigationSideBar.categories")}
          </h4>
          <div className="flex gap-3">
            <Link to="new">
              <Button
                variant="primary"
                className="gap-2"
                data-testid={CATEGORIES_PAGE_HANDLES.CREATE_BUTTON}
              >
                <Plus className="size-4" />
                {t("adminCategoriesView.button.createNew")}
              </Button>
            </Link>
            <Dialog>
              <DialogTrigger asChild>
                <Button
                  className="gap-2"
                  variant="destructive"
                  disabled={isEmpty(selectedCategories)}
                  data-testid={CATEGORIES_PAGE_HANDLES.DELETE_SELECTED_BUTTON}
                >
                  <Trash className="size-4" />
                  {t("adminCategoriesView.button.deleteSelected")}
                </Button>
              </DialogTrigger>
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
                      onClick={handleDelete}
                      variant="destructive"
                      data-testid={CATEGORIES_PAGE_HANDLES.DELETE_DIALOG_CONFIRM_BUTTON}
                    >
                      {t("common.button.delete")}
                    </Button>
                  </DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2">
          <SearchFilter
            filters={filterConfig}
            values={searchParams}
            onChange={handleFilterChange}
            isLoading={isPending}
          />
        </div>
        <Table data-testid={CATEGORIES_PAGE_HANDLES.TABLE} className="border bg-neutral-50">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header, index) => (
                  <TableHead key={header.id} className={cn({ "size-12": index === 0 })}>
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody data-testid={CATEGORIES_PAGE_HANDLES.TABLE_BODY}>
            {table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() && "selected"}
                data-testid={CATEGORIES_PAGE_HANDLES.row(row.original.id)}
                onClick={() => handleRowClick(row.original.id)}
                className="cursor-pointer hover:bg-neutral-100"
              >
                {row.getVisibleCells().map((cell, index) => (
                  <TableCell key={cell.id} className={cn({ "size-12": index === 0 })}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </PageWrapper>
  );
};

export default Categories;
