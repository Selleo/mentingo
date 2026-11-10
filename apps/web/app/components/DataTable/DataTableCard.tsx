import { cn } from "~/lib/utils";

import type { ReactNode } from "react";

type DataTableCardProps = {
  children: ReactNode;
  className?: string;
};

/** One card holding a table's toolbar, selection bar, rows and pagination. */
export function DataTableCard({ children, className }: DataTableCardProps) {
  return (
    <section
      className={cn("overflow-hidden rounded-lg border border-neutral-200 bg-white", className)}
    >
      {children}
    </section>
  );
}
