import { useState } from "react";
import { useTranslation } from "react-i18next";

import SortButton from "~/components/TableSortButton/TableSortButton";
import { Checkbox } from "~/components/ui/checkbox";
import { handleRowSelectionRange } from "~/utils/tableRangeSelection";

import { GROUPS_PAGE_HANDLES } from "../../../../../e2e/data/groups/handles";

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
            data-testid={GROUPS_PAGE_HANDLES.SELECT_ALL_CHECKBOX}
            checked={table.getIsAllPageRowsSelected()}
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            aria-label="Select all"
          />
        ),
        cell: ({ row, table }) => (
          <Checkbox
            checked={row.getIsSelected()}
            aria-label="Select row"
            data-testid={GROUPS_PAGE_HANDLES.rowCheckbox(row.original.id)}
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
          <SortButton<GroupColumns> testId={GROUPS_PAGE_HANDLES.SORT_NAME} column={column}>
            {t("adminGroupsView.name")}
          </SortButton>
        ),
      },
      {
        accessorKey: "characteristic",
        header: ({ column }) => (
          <SortButton<GroupColumns>
            testId={GROUPS_PAGE_HANDLES.SORT_CHARACTERISTIC}
            column={column}
          >
            {t("adminGroupsView.characteristic")}
          </SortButton>
        ),
      },
    ],
  };
};
