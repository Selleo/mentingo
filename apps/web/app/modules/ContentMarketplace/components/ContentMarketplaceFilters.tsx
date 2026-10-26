import { CONTENT_MARKETPLACE_DURATIONS } from "@repo/shared";
import { RotateCcw, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { SearchInput } from "~/components/SearchInput/SearchInput";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { ReportOptionPicker } from "~/modules/Reports/components/ReportOptionPicker";

import { CONTENT_MARKETPLACE_FILTER_ALL } from "../contentMarketplace.constants";

type ContentMarketplaceFiltersProps = {
  search: string;
  category: string;
  duration: string;
  categories: string[];
  onSearchChange: (search: string) => void;
  onCategoryChange: (category: string) => void;
  onDurationChange: (duration: string) => void;
};

export function ContentMarketplaceFilters({
  search,
  category,
  duration,
  categories,
  onSearchChange,
  onCategoryChange,
  onDurationChange,
}: ContentMarketplaceFiltersProps) {
  const { t } = useTranslation();
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const filterCount = [category, duration].filter(
    (value) => value !== CONTENT_MARKETPLACE_FILTER_ALL,
  ).length;

  return (
    <section
      aria-label={t("reports.filters.toggle")}
      className="rounded-lg border border-neutral-200 bg-white"
    >
      <div className="flex flex-wrap items-center gap-2 p-4">
        <SearchInput
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={t("contentMarketplace.search")}
          aria-label={t("contentMarketplace.search")}
          wrapperClassName="w-full max-w-none sm:w-64 sm:max-w-sm sm:flex-grow-0"
          className="h-10 max-w-none"
        />
        <Button
          type="button"
          variant="outline"
          className={cn("gap-2", isFiltersOpen && "border-primary-500 bg-primary-50")}
          aria-expanded={isFiltersOpen}
          aria-controls="marketplace-filter-options"
          onClick={() => setIsFiltersOpen((open) => !open)}
        >
          <SlidersHorizontal className="size-4" aria-hidden />
          {t("reports.filters.toggle")}
          {filterCount > 0 && (
            <span className="details-md rounded-full bg-primary-700 px-1.5 text-contrast">
              {filterCount}
            </span>
          )}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="gap-2 text-neutral-700"
          onClick={() => {
            onSearchChange("");
            onCategoryChange(CONTENT_MARKETPLACE_FILTER_ALL);
            onDurationChange(CONTENT_MARKETPLACE_FILTER_ALL);
          }}
        >
          <RotateCcw className="size-4" aria-hidden />
          {t("reports.filters.resetAll")}
        </Button>
      </div>
      {isFiltersOpen && (
        <div
          id="marketplace-filter-options"
          className="flex flex-wrap gap-4 border-t border-neutral-100 p-4"
        >
          <div className="flex w-full flex-col gap-2 sm:w-64">
            <span className="text-sm font-medium text-neutral-700">
              {t("contentMarketplace.category")}
            </span>
            <ReportOptionPicker
              label={t("contentMarketplace.category")}
              placeholder={t("contentMarketplace.allCategories")}
              className="w-full"
              options={[
                {
                  id: CONTENT_MARKETPLACE_FILTER_ALL,
                  label: t("contentMarketplace.allCategories"),
                },
                ...categories.map((value) => ({ id: value, label: value })),
              ]}
              selectedIds={[category]}
              onToggle={({ id }) => onCategoryChange(id)}
            />
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-52">
            <span className="text-sm font-medium text-neutral-700">
              {t("contentMarketplace.duration")}
            </span>
            <ReportOptionPicker
              label={t("contentMarketplace.duration")}
              placeholder={t("contentMarketplace.anyDuration")}
              className="w-full"
              options={[
                { id: CONTENT_MARKETPLACE_FILTER_ALL, label: t("contentMarketplace.anyDuration") },
                ...Object.values(CONTENT_MARKETPLACE_DURATIONS).map((value) => ({
                  id: value,
                  label: t(`contentMarketplace.durations.${value}`),
                })),
              ]}
              selectedIds={[duration]}
              onToggle={({ id }) => onDurationChange(id)}
            />
          </div>
        </div>
      )}
    </section>
  );
}
