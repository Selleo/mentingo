import { useTranslation } from "react-i18next";

import SortButton from "~/components/TableSortButton/TableSortButton";
import { Checkbox } from "~/components/ui/checkbox";

import type { ColumnDef } from "@tanstack/react-table";
import type { GetAllGroupsResponse } from "~/api/generated-api";

type GroupColumns = GetAllGroupsResponse["data"][number];

export const useGroupTable: () => { columns: ColumnDef<GroupColumns>[] } = () => {
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
          <SortButton<GroupColumns> column={column}>{t("adminGroupsView.name")}</SortButton>
        ),
      },
      {
        accessorKey: "characteristic",
        header: ({ column }) => (
          <SortButton<GroupColumns> column={column}>
            {t("adminGroupsView.characteristic")}
          </SortButton>
        ),
      },
    ],
  };
};
