import { format } from "date-fns";

import SortButton from "~/components/TableSortButton/TableSortButton";
import { Badge } from "~/components/ui/badge";
import { Checkbox } from "~/components/ui/checkbox";
import { formatHtmlString } from "~/lib/formatters/formatHtmlString";
import { handleRowSelectionRange } from "~/utils/tableRangeSelection";

import { CATEGORIES_PAGE_HANDLES } from "../../../../e2e/data/categories/handles";

import type { ColumnDef } from "@tanstack/react-table";
import type { TFunction } from "i18next";
import type { Dispatch, SetStateAction } from "react";
import type { GetAllCategoriesResponse } from "~/api/generated-api";

export type Category = GetAllCategoriesResponse["data"][number];

type GetCategoriesColumnsOptions = {
  lastSelectedRowIndex: number;
  setLastSelectedRowIndex: Dispatch<SetStateAction<number>>;
  t: TFunction;
};

export const getCategoriesColumns = ({
  lastSelectedRowIndex,
  setLastSelectedRowIndex,
  t,
}: GetCategoriesColumnsOptions): ColumnDef<Category>[] => [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        data-testid={CATEGORIES_PAGE_HANDLES.SELECT_ALL_CHECKBOX}
        checked={table.getIsAllPageRowsSelected()}
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row, table }) => (
      <Checkbox
        checked={row.getIsSelected()}
        aria-label="Select row"
        data-testid={CATEGORIES_PAGE_HANDLES.rowCheckbox(row.original.id)}
        onClick={(event) => {
          event.stopPropagation();
          handleRowSelectionRange({
            table,
            event,
            lastSelectedRowIndex,
            setLastSelectedRowIndex,
            id: row.id,
            idx: row.index,
            value: row.getIsSelected(),
          });
        }}
      />
    ),
    enableSorting: false,
  },
  {
    accessorKey: "title",
    header: ({ column }) => (
      <SortButton<Category> testId={CATEGORIES_PAGE_HANDLES.SORT_TITLE} column={column}>
        {t("adminCategoriesView.field.title")}
      </SortButton>
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
      <SortButton<Category> testId={CATEGORIES_PAGE_HANDLES.SORT_CREATED_AT} column={column}>
        {t("adminCategoriesView.field.createdAt")}
      </SortButton>
    ),
    cell: ({ row }) => row.original.createdAt && format(new Date(row.original.createdAt), "PPpp"),
  },
];
