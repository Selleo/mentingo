import { Link, useNavigate } from "@remix-run/react";
import {
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  flexRender,
} from "@tanstack/react-table";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";

import { useGroupsQuerySuspense } from "~/api/queries/admin/useGroups";
import { Button } from "~/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { cn } from "~/lib/utils";
import { useGroupTable } from "~/modules/Admin/Groups/hooks/useGroupTable";

import type { SortingState, RowSelectionState } from "@tanstack/react-table";
import type { ReactElement } from "react";

const Groups = (): ReactElement => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { columns } = useGroupTable();

  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const { data } = useGroupsQuerySuspense({});

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

  const handleGroupEdit = useCallback(
    (groupId: string) => () => {
      navigate(groupId);
    },
    [navigate],
  );

  return (
    <div className="flex flex-col">
      <h4 className={"text-2xl font-bold"}>{t("navigationSideBar.groups")}</h4>
      <div className="ml-auto flex items-center gap-x-2 px-4 py-2">
        <div className="flex items-center justify-between gap-2">
          <Link to={"new"}>
            <Button>{t("adminGroupsView.buttons.create")}</Button>
          </Link>
        </div>
      </div>
      <Table className="border bg-neutral-50">
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
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
              onClick={handleGroupEdit(row.original?.id)}
              className="cursor-pointer hover:bg-neutral-100"
            >
              {row.getVisibleCells().map((cell, index) => (
                <TableCell key={cell.id} className={cn({ "!w-12": index === 0 })}>
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

export default Groups;
