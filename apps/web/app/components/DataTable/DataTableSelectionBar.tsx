import { useTranslation } from "react-i18next";

import { cn } from "~/lib/utils";

import type { ReactNode } from "react";

type DataTableSelectionBarProps = {
  selectedCount: number;
  /** Bulk actions for the selected rows. */
  children: ReactNode;
  countTestId?: string;
};

export function DataTableSelectionBar({
  selectedCount,
  children,
  countTestId,
}: DataTableSelectionBarProps) {
  const { t } = useTranslation();
  const hasSelection = selectedCount > 0;

  return (
    <div
      aria-hidden={!hasSelection}
      className={cn(
        "grid transition-[grid-template-rows,opacity] duration-200 ease-out",
        hasSelection && "grid-rows-[1fr] opacity-100",
        !hasSelection && "grid-rows-[0fr] opacity-0",
      )}
    >
      <div className="overflow-hidden">
        <div className="flex items-center gap-3 border-t border-neutral-200 bg-primary-50 p-2">
          {children}
          <span data-testid={countTestId} className="text-sm font-medium text-neutral-700">
            {t("common.dataTable.selectedCount", { count: selectedCount })}
          </span>
        </div>
      </div>
    </div>
  );
}
