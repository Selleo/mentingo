import { createSelectColumn, type RowRangeSelection } from "~/components/DataTable";
import SortButton from "~/components/TableSortButton/TableSortButton";

import { GROUPS_PAGE_HANDLES } from "../../../../e2e/data/groups/handles";

import type { ColumnDef } from "@tanstack/react-table";
import type { TFunction } from "i18next";
import type { GetAllGroupsResponse } from "~/api/generated-api";

export type GroupRow = GetAllGroupsResponse["data"][number];

/** Table columns sortable on the server, mapped to the API sort field they order by. */
export const GROUPS_TABLE_SORT_FIELDS = {
  name: "name",
  characteristic: "characteristic",
} as const;

type GetGroupsColumnsOptions = {
  rowRangeSelection: RowRangeSelection;
  t: TFunction;
};

export const getGroupsColumns = ({
  rowRangeSelection,
  t,
}: GetGroupsColumnsOptions): ColumnDef<GroupRow>[] => {
  return [
    createSelectColumn<GroupRow>({
      rowRangeSelection,
      getCheckboxTestId: (group) => GROUPS_PAGE_HANDLES.rowCheckbox(group.id),
      selectAllTestId: GROUPS_PAGE_HANDLES.SELECT_ALL_CHECKBOX,
      selectAllLabel: t("common.dataTable.selectAll"),
      selectRowLabel: t("common.dataTable.selectRow"),
    }),
    {
      accessorKey: "name",
      header: ({ column }) => (
        <SortButton<GroupRow> testId={GROUPS_PAGE_HANDLES.SORT_NAME} column={column}>
          {t("adminGroupsView.name")}
        </SortButton>
      ),
      cell: ({ row }) => <span className="font-medium text-neutral-950">{row.original.name}</span>,
    },
    {
      accessorKey: "characteristic",
      header: ({ column }) => (
        <SortButton<GroupRow> testId={GROUPS_PAGE_HANDLES.SORT_CHARACTERISTIC} column={column}>
          {t("adminGroupsView.characteristic")}
        </SortButton>
      ),
      cell: ({ row }) => (
        <span className="line-clamp-2 max-w-xl text-neutral-800">
          {row.original.characteristic}
        </span>
      ),
    },
  ];
};
