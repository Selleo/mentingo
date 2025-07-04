import { Link, useNavigate } from "@remix-run/react";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type RowSelectionState,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { format } from "date-fns";
import { isEmpty } from "lodash-es";
import { Trash } from "lucide-react";
import { useState, useTransition } from "react";
import { useTranslation } from "react-i18next";

import { useDeleteCategory } from "~/api/mutations/admin/useDeleteCategory";
import { useDeleteManyCategories } from "~/api/mutations/admin/useDeleteManyCategories";
import { useCategoriesSuspense, usersQueryOptions } from "~/api/queries";
import { CATEGORIES_QUERY_KEY } from "~/api/queries/useCategories";
import { queryClient } from "~/api/queryClient";
import SortButton from "~/components/TableSortButton/TableSortButton";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
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
import { useToast } from "~/components/ui/use-toast";
import { formatHtmlString } from "~/lib/formatters/formatHtmlString";
import { cn } from "~/lib/utils";
import {
  type FilterConfig,
  type FilterValue,
  SearchFilter,
} from "~/modules/common/SearchFilter/SearchFilter";

import type { GetAllCategoriesResponse } from "~/api/generated-api";

type TCategory = GetAllCategoriesResponse["data"][number];

export const clientLoader = async () => {
  await queryClient.prefetchQuery(usersQueryOptions());

  return null;
};

const Categories = () => {
  const navigate = useNavigate();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [searchParams, setSearchParams] = useState<{
    title?: string;
    archived?: boolean;
  }>({ archived: false });
  const { mutate: deleteManyCategories } = useDeleteManyCategories();
  const { mutate: deleteCategory } = useDeleteCategory();
  const [isPending, startTransition] = useTransition();
  const { data } = useCategoriesSuspense(searchParams);
  const { t } = useTranslation();
  const { toast } = useToast();

  const filterConfig: FilterConfig[] = [
    {
      name: "title",
      type: "text",
      placeholder: t("adminCategoriesView.filters.placeholder.title"),
    },
    {
      name: "archived",
      type: "status",
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

  const columns: ColumnDef<TCategory>[] = [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
          onClick={(e) => e.stopPropagation()}
        />
      ),
      enableSorting: false,
    },
    {
      accessorKey: "title",
      header: ({ column }) => (
        <SortButton<TCategory> column={column}>{t("adminCategoriesView.field.title")}</SortButton>
      ),
      cell: ({ row }) => (
        <div className="max-w-md truncate">{formatHtmlString(row.original.title)}</div>
      ),
    },
    {
      accessorKey: "archived",
      header: t("adminCategoriesView.field.status"),
      cell: ({ row }) => {
        const isArchived = row.original.archived;
        return (
          <Badge variant={isArchived ? "outline" : "secondary"} className="w-max">
            {isArchived ? t("common.other.archived") : t("common.other.active")}
          </Badge>
        );
      },
    },
    {
      accessorKey: "createdAt",
      header: ({ column }) => (
        <SortButton<TCategory> column={column}>
          {t("adminCategoriesView.field.createdAt")}
        </SortButton>
      ),
      cell: ({ row }) => row.original.createdAt && format(new Date(row.original.createdAt), "PPpp"),
    },
  ];

  const table = useReactTable({
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
    try {
      if (selectedCategories.length === 1) {
        deleteCategory(selectedCategories[0], {
          onSuccess: () => {
            setRowSelection({});
            queryClient.invalidateQueries({ queryKey: CATEGORIES_QUERY_KEY });
            toast({
              title: t("adminCategoriesView.toast.deleteCategorySuccessfully"),
            });
          },
          onError: (error) => {
            console.error(error);
            toast({
              title: t("adminCategoriesView.toast.deleteCategoryFailed"),
            });
          },
        });
      } else {
        deleteManyCategories(selectedCategories, {
          onSuccess: () => {
            setRowSelection({});
            queryClient.invalidateQueries({ queryKey: CATEGORIES_QUERY_KEY });
            toast({
              title: t("adminCategoriesView.toast.deleteCategorySuccessfully"),
            });
          },
          onError: (error) => {
            console.error(error);
            toast({
              title: t("adminCategoriesView.toast.deleteCategoryFailed"),
            });
          },
        });
      }
    } catch (error) {
      console.error(error);
      throw new Error("Failed to delete categories");
    }
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
    <div className="flex flex-col">
      <div className="flex items-center justify-between gap-2">
        <Link to="new">
          <Button variant="outline">{t("adminCategoriesView.button.createNew")}</Button>
        </Link>
        <SearchFilter
          filters={filterConfig}
          values={searchParams}
          onChange={handleFilterChange}
          isLoading={isPending}
        />
        <div className="ml-auto flex items-center gap-x-2 px-4 py-2">
          <p
            className={cn("text-sm", {
              "text-neutral-500": isEmpty(selectedCategories),
              "text-neutral-900": !isEmpty(selectedCategories),
            })}
          >
            {t("common.other.selected")} ({selectedCategories.length})
          </p>

          <Dialog>
            <DialogTrigger disabled={isEmpty(selectedCategories)}>
              <Button
                size="sm"
                className="flex items-center gap-x-2"
                disabled={isEmpty(selectedCategories)}
              >
                <Trash className="size-3" />
                <span className="text-xs">{t("adminCategoriesView.button.deleteSelected")}</span>
              </Button>
            </DialogTrigger>
            <DialogPortal>
              <DialogOverlay className="bg-primary-400 opacity-65" />
              <DialogContent className="max-w-md">
                <DialogTitle className="text-xl font-semibold text-neutral-900">
                  {getDeleteModalTitle()}
                </DialogTitle>
                <DialogDescription className="mt-2 text-sm text-neutral-600">
                  {getDeleteModalDescription()}
                </DialogDescription>
                <div className="mt-6 flex justify-end gap-4">
                  <DialogClose>
                    <Button variant="ghost" className="text-primary-800">
                      {t("common.button.cancel")}
                    </Button>
                  </DialogClose>
                  <DialogClose>
                    <Button
                      onClick={handleDelete}
                      className="bg-error-500 text-white hover:bg-error-600"
                    >
                      {t("common.button.delete")}
                    </Button>
                  </DialogClose>
                </div>
              </DialogContent>
            </DialogPortal>
          </Dialog>
        </div>
      </div>
      <Table className="border bg-neutral-50">
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
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow
              key={row.id}
              data-state={row.getIsSelected() && "selected"}
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
  );
};

export default Categories;
