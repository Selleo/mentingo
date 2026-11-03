import { useState } from "react";

import { usePaginationReducer } from "~/hooks/usePaginationReducer";

import { OVERVIEW_VIEWS } from "../utils/competenciesOverview.utils";

import type { CompetencyReadiness } from "../competencies.types";
import type { OverviewView } from "../utils/competenciesOverview.utils";

export function useCompetenciesOverviewFilters() {
  const [profileFilter, setProfileFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<CompetencyReadiness | null>(null);
  const [view, setView] = useState<OverviewView>(OVERVIEW_VIEWS.LIST);
  const { pagination, setSearch, setPage, setPerPage } = usePaginationReducer({ perPage: 20 });

  const resetPage = () => setPage(1);
  const showAssignments = () => {
    setView(OVERVIEW_VIEWS.LIST);
    setStatusFilter(null);
  };

  const query = { ...pagination, profileFilter, statusFilter, view };
  const hasFilters = Boolean(pagination.search.trim() || profileFilter || statusFilter);

  return {
    query,
    hasFilters,
    ...pagination,
    profileFilter,
    setProfileFilter,
    statusFilter,
    setStatusFilter,
    view,
    setView,
    setSearch,
    setPage,
    setPerPage,
    resetPage,
    showAssignments,
  };
}
