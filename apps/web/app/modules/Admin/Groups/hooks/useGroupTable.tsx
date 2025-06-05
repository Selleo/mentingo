import { useTranslation } from "react-i18next";

import SortButton from "~/components/TableSortButton/TableSortButton";
import { Checkbox } from "~/components/ui/checkbox";

import type { ColumnDef } from "@tanstack/react-table";

export const useGroupTable: () => { columns: ColumnDef<unknown>[] } = () => {
  const { t } = useTranslation();

  return {
    columns: [
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
        accessorKey: "name",
        header: ({ column }) => (
          <SortButton<unknown> column={column}>{t("adminGroupsView.name")}</SortButton>
        ),
      },
      {
        accessorKey: "description",
        header: ({ column }) => (
          <SortButton<unknown> column={column}>{t("adminGroupsView.description")}</SortButton>
        ),
      },
    ],
  };
};
