import { Pagination } from "~/components/Pagination/Pagination";

import type { ComponentProps } from "react";

type DataTablePaginationProps = Omit<ComponentProps<typeof Pagination>, "className">;

/** Pagination footer for a `DataTableCard`; hidden when the list is empty. */
export function DataTablePagination(props: DataTablePaginationProps) {
  if (!props.totalItems) return null;

  return <Pagination className="border-t border-neutral-200" {...props} />;
}
