import { useTranslation } from "react-i18next";

import { cn } from "~/lib/utils";

import { COMPETENCIES_HANDLES } from "../../../../e2e/data/competencies/handles";
import { STATUS_DOT_CLASS_NAMES, STATUS_FILTERS } from "../utils/competenciesOverview.utils";
import { READINESS_TRANSLATION_KEYS } from "../utils/competenciesReadiness.utils";

import type { CompetenciesOverviewModel } from "../hooks/competencies-hook-models.types";

type CompetenciesReadinessFiltersProps = Pick<
  CompetenciesOverviewModel,
  "statusFilter" | "setStatusFilter" | "counts" | "resetPage"
>;

export function CompetenciesReadinessFilters({
  statusFilter,
  setStatusFilter,
  counts,
  resetPage,
}: CompetenciesReadinessFiltersProps) {
  const { t } = useTranslation();
  if (!counts) return null;
  return (
    <div
      role="radiogroup"
      aria-label={t("competencies.tableStatus")}
      className="flex flex-wrap gap-2 border-t border-neutral-200 px-6 py-3"
    >
      {STATUS_FILTERS.map((status) => {
        const isActive = statusFilter === status;
        const count = status ? counts[status] : counts.all;
        return (
          <button
            key={status ?? "all"}
            type="button"
            role="radio"
            aria-checked={isActive}
            data-testid={COMPETENCIES_HANDLES.STATUS_FILTER(status ?? "all")}
            onClick={() => {
              setStatusFilter(status);
              resetPage();
            }}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600",
              isActive && "border-primary-700 bg-primary-700 text-white",
              !isActive && "border-neutral-200 bg-white text-neutral-900 hover:border-primary-300",
            )}
          >
            {status && (
              <span
                aria-hidden="true"
                className={cn(
                  "size-2 rounded-full",
                  STATUS_DOT_CLASS_NAMES[status],
                  isActive && "ring-2 ring-white/60",
                )}
              />
            )}
            {status
              ? t(`competencies.readiness.${READINESS_TRANSLATION_KEYS[status]}`)
              : t("competencies.overview.allPeople")}
            <span
              className={cn(
                "rounded-full px-1.5 text-xs font-semibold",
                isActive && "bg-white/20 text-white",
                !isActive && "bg-neutral-100 text-neutral-800",
              )}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
