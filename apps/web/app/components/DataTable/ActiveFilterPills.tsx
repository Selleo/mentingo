import { X } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { ActiveTableFilter } from "./dataTable.types";

type ActiveFilterPillsProps = {
  filters: ActiveTableFilter[];
  getPillTestId?: (filterId: string) => string;
  getRemoveTestId?: (filterId: string) => string;
};

export function ActiveFilterPills({
  filters,
  getPillTestId,
  getRemoveTestId,
}: ActiveFilterPillsProps) {
  const { t } = useTranslation();

  if (!filters.length) return null;

  return (
    <ul className="flex flex-wrap items-center gap-2" aria-label={t("common.dataTable.filters")}>
      {filters.map(({ id, label, value, onRemove }) => (
        <li
          key={id}
          data-testid={getPillTestId?.(id)}
          className="inline-flex h-8 items-center gap-1.5 rounded-full border border-primary-200 bg-primary-50 pl-3 pr-1 text-sm"
        >
          <span className="font-medium text-neutral-950">
            {t("common.dataTable.labeledValue", { label, value })}
          </span>
          <button
            type="button"
            onClick={onRemove}
            aria-label={t("common.dataTable.removeFilter", { filter: label })}
            data-testid={getRemoveTestId?.(id)}
            className="flex size-6 items-center justify-center rounded-full text-neutral-600 transition-colors hover:bg-primary-100 hover:text-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        </li>
      ))}
    </ul>
  );
}
