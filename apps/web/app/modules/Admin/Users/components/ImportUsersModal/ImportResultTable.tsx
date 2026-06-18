import { flexRender } from "@tanstack/react-table";
import { Mail } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { cn } from "~/lib/utils";

import type { Table as ReactTable } from "@tanstack/react-table";

interface ImportResultTableProps<TData> {
  table: ReactTable<TData>;
  emailColumnClassName?: string;
}

export const ImportResultTable = <TData,>({
  table,
  emailColumnClassName,
}: ImportResultTableProps<TData>) => (
  <Table className="table-fixed bg-neutral-50">
    <TableHeader>
      {table.getHeaderGroups().map((headerGroup) => (
        <TableRow key={headerGroup.id}>
          {headerGroup.headers.map((header, index) => (
            <TableHead
              key={header.id}
              className={cn(
                "h-10 bg-neutral-50 px-4 text-xs font-semibold uppercase text-neutral-500",
                index === 0 && emailColumnClassName,
              )}
            >
              {header.isPlaceholder
                ? null
                : flexRender(header.column.columnDef.header, header.getContext())}
            </TableHead>
          ))}
        </TableRow>
      ))}
    </TableHeader>
    <TableBody>
      {table.getRowModel().rows.map((row) => (
        <TableRow key={row.id} className="bg-white hover:bg-neutral-50">
          {row.getVisibleCells().map((cell, index) => (
            <TableCell
              key={cell.id}
              className={cn("h-12 px-4 py-3 align-middle", index === 0 && emailColumnClassName)}
            >
              {flexRender(cell.column.columnDef.cell, cell.getContext())}
            </TableCell>
          ))}
        </TableRow>
      ))}
    </TableBody>
  </Table>
);

export const ImportResultEmailCell = ({ email }: { email: string }) => (
  <div className="flex min-w-0 items-center gap-2 font-medium text-neutral-900">
    <Mail className="size-4 shrink-0 text-neutral-400" />
    <span className="min-w-0 truncate" title={email}>
      {email}
    </span>
  </div>
);
