import { flexRender, type Row } from "@tanstack/react-table";

import { TableCell, TableRow } from "~/components/ui/table";
import { cn } from "~/lib/utils";

import { ActivityLogMetadata } from "./ActivityLogMetadata";

import type { ActivityLogItem } from "../activityLogs.utils";

type ActivityLogAccordionRowProps = {
  row: Row<ActivityLogItem>;
  columnsLength: number;
  isExpanded: boolean;
};

export const ActivityLogAccordionRow = ({
  row,
  columnsLength,
  isExpanded,
}: ActivityLogAccordionRowProps) => {
  return (
    <>
      <TableRow
        key={row.id}
        data-state={isExpanded ? "open" : undefined}
        className={cn("hover:bg-neutral-100", isExpanded && "bg-neutral-50")}
      >
        {row.getVisibleCells().map((cell, index) => (
          <TableCell key={cell.id} className={index === columnsLength - 1 ? "text-right" : ""}>
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </TableCell>
        ))}
      </TableRow>

      {isExpanded && (
        <TableRow id={`activity-log-details-${row.id}`} className="bg-neutral-50">
          <TableCell colSpan={columnsLength} className="px-0 py-0">
            <div className="border-t border-neutral-200 px-5 py-5">
              <ActivityLogMetadata
                metadata={row.original.metadata}
                actionType={row.original.actionType}
              />
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
};
