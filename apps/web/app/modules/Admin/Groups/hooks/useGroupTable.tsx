import { useState } from "react";
import { useTranslation } from "react-i18next";

import SortButton from "~/components/TableSortButton/TableSortButton";
import { Checkbox } from "~/components/ui/checkbox";
import { handleRowSelectionRange } from "~/utils/tableRangeSelection";

import type { ColumnDef } from "@tanstack/react-table";
import type { GetAllGroupsResponse } from "~/api/generated-api";

type GroupColumns = GetAllGroupsResponse["data"][number];

export const useGroupTable: () => { columns: ColumnDef<GroupColumns>[] } = () => {
  const { t } = useTranslation();
  const [lastSelectedRowIndex, setLastSelectedRowIndex] = useState<number>(0);

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
        cell: ({ row, table }) => (
          <Checkbox
            checked={row.getIsSelected()}
            aria-label="Select row"
            onClick={(event) => {
              event.stopPropagation();
              handleRowSelectionRange({
                table,
                event,
                id: row.id,
                idx: row.index,
                value: row.getIsSelected(),
                lastSelectedRowIndex,
                setLastSelectedRowIndex,
              });
            }}
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
