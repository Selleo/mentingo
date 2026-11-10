import { SearchX } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";

type DataTableEmptyStateProps = {
  title?: string;
  description?: string;
  onResetFilters?: () => void;
  testId?: string;
};

export function DataTableEmptyState({
  title,
  description,
  onResetFilters,
  testId,
}: DataTableEmptyStateProps) {
  const { t } = useTranslation();

  return (
    <div data-testid={testId} className="flex flex-col items-center px-4 py-14 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-primary-50 text-primary-700">
        <SearchX className="size-6" aria-hidden />
      </span>
      <p className="mt-4 text-lg font-semibold text-neutral-950">
        {title ?? t("common.dataTable.emptyTitle")}
      </p>
      <p className="mt-1 max-w-sm text-xs text-neutral-600">
        {description ?? t("common.dataTable.emptyDescription")}
      </p>
      {onResetFilters && (
        <Button type="button" variant="outline" className="mt-5" onClick={onResetFilters}>
          {t("common.dataTable.resetFilters")}
        </Button>
      )}
    </div>
  );
}
