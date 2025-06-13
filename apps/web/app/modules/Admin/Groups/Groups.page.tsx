import { Link, useNavigate } from "@remix-run/react";
import {
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  flexRender,
} from "@tanstack/react-table";
import { isEmpty } from "lodash-es";
import { Trash } from "lucide-react";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";

import { useBulkDeleteGroups } from "~/api/mutations/admin/useBulkDeleteGroups";
import { useGroupsQuerySuspense } from "~/api/queries/admin/useGroups";
import { Button } from "~/components/ui/button";
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
import { cn } from "~/lib/utils";
import { useGroupTable } from "~/modules/Admin/Groups/hooks/useGroupTable";

import type { SortingState, RowSelectionState } from "@tanstack/react-table";
import type { ReactElement, FormEvent } from "react";

const Groups = (): ReactElement => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { columns } = useGroupTable();

  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const { data } = useGroupsQuerySuspense();
  const { mutateAsync: deleteGroupsMutation } = useBulkDeleteGroups();

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

  const selectedRows = table.getSelectedRowModel().rows.map((row) => row.original.id);

  const handleGroupEdit = useCallback(
    (groupId: string) => () => {
      navigate(groupId);
    },
    [navigate],
  );

  const handleGroupsDelete = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      await deleteGroupsMutation(selectedRows);
      setRowSelection({});
    },
    [deleteGroupsMutation, selectedRows],
  );

  return (
    <div className="flex flex-col">
      <h4 className={"text-2xl font-bold"}>{t("navigationSideBar.groups")}</h4>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center justify-between gap-2 pt-6">
          <Link to={"new"}>
            <Button variant={"outline"}>{t("adminGroupsView.buttons.create")}</Button>
          </Link>
        </div>
        <div className={"flex items-center justify-between gap-2 px-4 py-2"}>
          <p
            className={cn("text-sm", {
              "text-neutral-500": isEmpty(selectedRows),
              "text-neutral-900": !isEmpty(selectedRows),
            })}
          >
            {t("common.other.selected")} ({selectedRows.length})
          </p>

          <Dialog>
            <DialogTrigger disabled={isEmpty(selectedRows)}>
              <Button
                size="sm"
                className="flex items-center gap-x-2"
                disabled={isEmpty(selectedRows)}
              >
                <Trash className="h-3 w-3" />
                <span className="text-xs">{t("adminGroupsView.buttons.deleteSelected")}</span>
              </Button>
            </DialogTrigger>
            <DialogPortal>
              <DialogOverlay />
              <DialogContent>
                <DialogTitle>{t("adminGroupsView.deleteGroup.title")}</DialogTitle>
                <DialogDescription>
                  {t("adminGroupsView.deleteGroup.description")}
                </DialogDescription>
                <form onSubmit={handleGroupsDelete}>
                  <div className={"flex justify-end gap-4"}>
                    <DialogClose>
                      <Button type={"reset"} variant={"ghost"}>
                        {t("adminGroupsView.deleteGroup.cancel")}
                      </Button>
                    </DialogClose>
                    <DialogClose>
                      <Button type={"submit"} variant={"secondary"}>
                        {t("adminGroupsView.deleteGroup.submit")}
                      </Button>
                    </DialogClose>
                  </div>
                </form>
              </DialogContent>
            </DialogPortal>
          </Dialog>
        </div>
      </div>
      <div className="ml-auto flex items-center gap-x-2 px-4 py-2"></div>
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
