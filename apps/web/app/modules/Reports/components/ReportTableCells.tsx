import SortButton from "~/components/TableSortButton/TableSortButton";
import { Progress } from "~/components/ui/progress";

import { formatReportPercent } from "../utils/reports.utils";

import type { HeaderContext } from "@tanstack/react-table";
import type { ReactNode } from "react";

/** A column header that sorts the table, on the server or in the browser. */
export const reportSortableHeader =
  <TData,>(label: string) =>
  ({ column }: HeaderContext<TData, unknown>) => (
    <SortButton<TData> column={column}>{label}</SortButton>
  );

export function ReportTextCell({ children }: { children: ReactNode }) {
  return <span className="block max-w-64 truncate">{children}</span>;
}

export function ReportNumberCell({ children }: { children: ReactNode }) {
  return <span className="tabular-nums">{children}</span>;
}

export function ReportPercentCell({ value }: { value: number | null | undefined }) {
  return <ReportNumberCell>{formatReportPercent(value)}</ReportNumberCell>;
}

export function ReportProgressCell({ value }: { value: number | null | undefined }) {
  return (
    <div className="flex items-center gap-2">
      <Progress
        value={value ?? 0}
        aria-hidden
        className="h-1.5 w-20 bg-neutral-200"
        indicatorClassName="bg-primary-600"
      />
      <ReportPercentCell value={value} />
    </div>
  );
}
