import { RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";

import { SearchInput } from "~/components/SearchInput/SearchInput";
import { Button } from "~/components/ui/button";

import { ActiveFilterPills } from "./ActiveFilterPills";

import type { ActiveTableFilter } from "./dataTable.types";
import type { ReactNode } from "react";

type DataTableToolbarProps = {
  searchValue?: string;
  onSearchChange?: (search: string) => void;
  searchPlaceholder?: string;
  searchTestId?: string;
  /** Filter controls, usually `OptionPicker`s, shown after the search. */
  children?: ReactNode;
  /** Chosen filters, shown as removable pills under the controls. */
  activeFilters?: ActiveTableFilter[];
  canResetFilters?: boolean;
  onResetFilters?: () => void;
  resetTestId?: string;
  getActiveFilterTestId?: (filterId: string) => string;
  getRemoveFilterTestId?: (filterId: string) => string;
};

export function DataTableToolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder,
  searchTestId,
  children,
  activeFilters = [],
  canResetFilters = false,
  onResetFilters,
  resetTestId,
  getActiveFilterTestId,
  getRemoveFilterTestId,
}: DataTableToolbarProps) {
  const { t } = useTranslation();

  return (
    <div
      role="search"
      aria-label={t("common.dataTable.filters")}
      className="flex flex-col gap-2 p-3"
    >
      <div className="flex flex-wrap items-center gap-2">
        {onSearchChange && (
          <SearchInput
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder ?? t("common.other.search")}
            wrapperClassName="w-full max-w-none sm:w-auto sm:min-w-64 sm:flex-1 lg:max-w-sm"
            className="h-10 max-w-none"
            clearable
            data-testid={searchTestId}
          />
        )}

        {children}

        {canResetFilters && onResetFilters && (
          <Button
            type="button"
            variant="ghost"
            className="h-10 gap-2 text-neutral-700"
            onClick={onResetFilters}
            data-testid={resetTestId}
          >
            <RotateCcw className="size-4" aria-hidden />
            {t("common.dataTable.resetFilters")}
          </Button>
        )}
      </div>

      <ActiveFilterPills
        filters={activeFilters}
        getPillTestId={getActiveFilterTestId}
        getRemoveTestId={getRemoveFilterTestId}
      />
    </div>
  );
}
