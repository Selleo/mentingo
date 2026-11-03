import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useCompetencyCatalog } from "~/api/queries/useCompetencyCatalog";
import { useCompetencyCategories } from "~/api/queries/useCompetencyCategories";
import { useDebounce } from "~/hooks/useDebounce";
import { usePaginationReducer } from "~/hooks/usePaginationReducer";

import { PICKER_PAGE } from "../utils/competenciesPicker.utils";

export function useCompetenciesCatalog() {
  const { t } = useTranslation();
  const [categoryId, setCategoryId] = useState("");
  const { pagination, setSearch, setPage, setPerPage } = usePaginationReducer({ perPage: 20 });
  const { search, page, perPage } = pagination;
  const debouncedSearch = useDebounce(search.trim());
  const hasCategories = Boolean(useCompetencyCategories(PICKER_PAGE).data?.pagination.totalItems);
  const query = useCompetencyCatalog({
    page,
    perPage,
    search: debouncedSearch || undefined,
    categoryId: categoryId || undefined,
  });
  const competencies = query.data?.data ?? [];
  const totalItems = query.data?.pagination.totalItems ?? 0;
  const hasFilters = Boolean(search.trim() || categoryId);

  return {
    t,
    search,
    setSearch,
    categoryId,
    setCategoryId,
    page,
    setPage,
    perPage,
    setPerPage,
    hasCategories,
    query,
    competencies,
    totalItems,
    hasFilters,
  };
}
