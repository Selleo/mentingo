import { type ColumnDef, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { t } from "i18next";
import { useMemo } from "react";

import { ScrollArea } from "~/components/ui/scroll-area";

import { ImportResultEmailCell, ImportResultTable } from "./ImportResultTable";

interface SkippedUsersListProps {
  emptyText: string;
  items: Array<{ email: string; reason: string }>;
}

interface SkippedUserImportRow {
  email: string;
  reason: string;
}

export const SkippedUsersList = ({ emptyText, items }: SkippedUsersListProps) => {
  const columns = useMemo<Array<ColumnDef<SkippedUserImportRow>>>(
    () => [
      {
        accessorKey: "email",
        header: t("adminUsersView.modal.importResult.email"),
        cell: ({ row }) => <ImportResultEmailCell email={row.original.email} />,
      },
      {
        accessorKey: "reason",
        header: t("adminUsersView.modal.importResult.reason"),
        cell: ({ row }) => (
          <p className="text-sm font-medium leading-5 text-neutral-700">{row.original.reason}</p>
        ),
      },
    ],
    [],
  );

  const table = useReactTable({
    data: items,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (!items.length) {
    return (
      <div className="flex min-h-52 items-center justify-center rounded-md border border-dashed border-neutral-300 bg-neutral-50 px-6 text-center text-sm text-neutral-600">
        {emptyText}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border border-neutral-200 bg-neutral-50">
      <ScrollArea className="h-64 w-full">
        <ImportResultTable table={table} emailColumnClassName="w-[38%]" />
      </ScrollArea>
    </div>
  );
};
