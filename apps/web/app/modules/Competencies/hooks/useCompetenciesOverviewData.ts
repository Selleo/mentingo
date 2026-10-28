import { useCompetencyMatrix } from "~/api/queries/useCompetencyMatrix";
import { useCompetencyPeople } from "~/api/queries/useCompetencyPeople";
import { useCompetencyProfiles } from "~/api/queries/useCompetencyProfiles";
import { useDebounce } from "~/hooks/useDebounce";

import {
  PROFILE_OPTIONS_PAGE,
  buildOverviewQueries,
  selectActiveOverviewQuery,
} from "../utils/competenciesOverview.utils";

import type { CompetenciesOverviewQueryOptions } from "./competencies-hooks.types";

export function useCompetenciesOverviewData(options: CompetenciesOverviewQueryOptions) {
  const search = useDebounce(options.search.trim());
  const profiles = useCompetencyProfiles(PROFILE_OPTIONS_PAGE).data?.data ?? [];
  const queries = buildOverviewQueries({ ...options, search }, profiles);
  const peopleQuery = useCompetencyPeople(queries.people, queries.peopleEnabled);
  const matrixQuery = useCompetencyMatrix(queries.matrix, queries.matrixEnabled);
  const activeQuery = selectActiveOverviewQuery(options.view, peopleQuery, matrixQuery);

  return {
    profiles,
    activeProfileFilter: queries.activeProfileFilter,
    profileOptions: profiles.map((profile) => ({ value: profile.id, label: profile.name })),
    people: peopleQuery.data?.data ?? [],
    counts: peopleQuery.data?.counts,
    totalItems: activeQuery.data?.pagination.totalItems ?? 0,
    matrixQuery,
    activeQuery,
  };
}
