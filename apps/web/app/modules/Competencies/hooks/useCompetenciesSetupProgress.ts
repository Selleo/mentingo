import { useCompetencyCategories } from "~/api/queries/useCompetencyCategories";

import { CATEGORY_OPTIONS_PAGE } from "../utils/competenciesCatalog.utils";
import { getCompetenciesSetupProgress } from "../utils/competenciesReadiness.utils";

import type { CompetenciesSummary } from "../competencies.types";

export function useCompetenciesSetupProgress(summary: CompetenciesSummary) {
  const categoryCount = useCompetencyCategories(CATEGORY_OPTIONS_PAGE).data?.pagination.totalItems;

  return {
    categoryCount,
    progress: getCompetenciesSetupProgress(summary, categoryCount ?? 0),
  };
}
