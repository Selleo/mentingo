import { type ColumnDef, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { t } from "i18next";
import { useMemo } from "react";

import { ScrollArea } from "~/components/ui/scroll-area";

import { ImportResultEmailCell, ImportResultTable } from "./ImportResultTable";

interface ImportedUsersListProps {
  emptyText: string;
  emails: string[];
}

interface ImportedUserImportRow {
  email: string;
}

export const ImportedUsersList = ({ emptyText, emails }: ImportedUsersListProps) => {
  const data = useMemo(() => emails.map((email) => ({ email })), [emails]);

  const columns = useMemo<Array<ColumnDef<ImportedUserImportRow>>>(
    () => [
      {
        accessorKey: "email",
        header: t("adminUsersView.modal.importResult.email"),
        cell: ({ row }) => <ImportResultEmailCell email={row.original.email} />,
      },
    ],
    [],
  );

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (!emails.length) {
    return (
      <div className="flex min-h-52 items-center justify-center rounded-md border border-dashed border-neutral-300 bg-neutral-50 px-6 text-center text-sm text-neutral-600">
        {emptyText}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border border-neutral-200 bg-neutral-50">
      <ScrollArea className="h-64 w-full">
        <ImportResultTable table={table} />
      </ScrollArea>
    </div>
  );
};
