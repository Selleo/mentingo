import { format } from "date-fns";

import { createSelectColumn, type RowRangeSelection } from "~/components/DataTable";
import SortButton from "~/components/TableSortButton/TableSortButton";
import { formatHtmlString } from "~/lib/formatters/formatHtmlString";

import { CATEGORIES_PAGE_HANDLES } from "../../../../e2e/data/categories/handles";

import type { ColumnDef } from "@tanstack/react-table";
import type { TFunction } from "i18next";
import type { GetAllCategoriesResponse } from "~/api/generated-api";

export type Category = GetAllCategoriesResponse["data"][number];

/** Table columns sortable on the server, mapped to the API sort field they order by. */
export const CATEGORIES_TABLE_SORT_FIELDS = {
  title: "title",
  createdAt: "creationDate",
} as const;

type GetCategoriesColumnsOptions = {
  rowRangeSelection: RowRangeSelection;
  t: TFunction;
};

export const getCategoriesColumns = ({
  rowRangeSelection,
  t,
}: GetCategoriesColumnsOptions): ColumnDef<Category>[] => {
  return [
    createSelectColumn<Category>({
      rowRangeSelection,
      getCheckboxTestId: (category) => CATEGORIES_PAGE_HANDLES.rowCheckbox(category.id),
      selectAllTestId: CATEGORIES_PAGE_HANDLES.SELECT_ALL_CHECKBOX,
      selectAllLabel: t("common.dataTable.selectAll"),
      selectRowLabel: t("common.dataTable.selectRow"),
    }),
    {
      accessorKey: "title",
      header: ({ column }) => (
        <SortButton<Category> testId={CATEGORIES_PAGE_HANDLES.SORT_TITLE} column={column}>
          {t("adminCategoriesView.field.title")}
        </SortButton>
      ),
      cell: ({ row }) => (
        <div className="max-w-md truncate font-medium text-neutral-950">
          {formatHtmlString(row.original.title)}
        </div>
      ),
    },
    {
      accessorKey: "createdAt",
      header: ({ column }) => (
        <SortButton<Category> testId={CATEGORIES_PAGE_HANDLES.SORT_CREATED_AT} column={column}>
          {t("adminCategoriesView.field.createdAt")}
        </SortButton>
      ),
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-neutral-800">
          {row.original.createdAt && format(new Date(row.original.createdAt), "PP")}
        </span>
      ),
    },
  ];
};
