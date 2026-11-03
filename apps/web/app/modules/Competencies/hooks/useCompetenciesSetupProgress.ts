import { useCompetencyCategories } from "~/api/queries/useCompetencyCategories";

import { PICKER_PAGE } from "../utils/competenciesPicker.utils";
import { getCompetenciesSetupProgress } from "../utils/competenciesReadiness.utils";

import type { CompetenciesSummary } from "../competencies.types";

export function useCompetenciesSetupProgress(summary: CompetenciesSummary) {
  const categoryCount = useCompetencyCategories(PICKER_PAGE).data?.pagination.totalItems;

  return {
    categoryCount,
    progress: getCompetenciesSetupProgress(summary, categoryCount ?? 0),
  };
}
