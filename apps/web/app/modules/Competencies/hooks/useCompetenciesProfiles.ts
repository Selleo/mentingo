import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useCompetencyCatalog } from "~/api/queries/useCompetencyCatalog";
import { useCompetencyProfiles } from "~/api/queries/useCompetencyProfiles";
import { useDebounce } from "~/hooks/useDebounce";
import { usePaginationReducer } from "~/hooks/usePaginationReducer";

import { COMPETENCY_OPTIONS_PAGE } from "../utils/competenciesProfiles.utils";

export function useCompetenciesProfiles() {
  const { t } = useTranslation();
  const [competencyId, setCompetencyId] = useState("");
  const { pagination, setSearch, setPage, setPerPage } = usePaginationReducer({ perPage: 20 });
  const { search, page, perPage } = pagination;
  const debouncedSearch = useDebounce(search.trim());
  const competencies = useCompetencyCatalog(COMPETENCY_OPTIONS_PAGE).data?.data ?? [];
  const query = useCompetencyProfiles({
    page,
    perPage,
    search: debouncedSearch || undefined,
    competencyId: competencyId || undefined,
  });
  const profiles = query.data?.data ?? [];
  const totalItems = query.data?.pagination.totalItems ?? 0;
  const hasFilters = Boolean(search.trim() || competencyId);

  return {
    t,
    search,
    setSearch,
    competencyId,
    setCompetencyId,
    page,
    setPage,
    perPage,
    setPerPage,
    competencies,
    query,
    profiles,
    totalItems,
    hasFilters,
  };
}
