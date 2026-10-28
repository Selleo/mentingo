import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useCompetencyCatalog } from "~/api/queries/useCompetencyCatalog";
import { useCompetencyCategories } from "~/api/queries/useCompetencyCategories";
import { useDebounce } from "~/hooks/useDebounce";
import { usePaginationReducer } from "~/hooks/usePaginationReducer";

import { CATEGORY_OPTIONS_PAGE } from "../utils/competenciesCatalog.utils";

export function useCompetenciesCatalog() {
  const { t } = useTranslation();
  const [categoryId, setCategoryId] = useState("");
  const { pagination, setSearch, setPage, setPerPage } = usePaginationReducer({ perPage: 20 });
  const { search, page, perPage } = pagination;
  const debouncedSearch = useDebounce(search.trim());
  const categories = useCompetencyCategories(CATEGORY_OPTIONS_PAGE).data?.data ?? [];
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
    categories,
    query,
    competencies,
    totalItems,
    hasFilters,
  };
}
