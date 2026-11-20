import { useState } from "react";

import { usePaginationReducer } from "~/hooks/usePaginationReducer";

import { OVERVIEW_VIEWS } from "../utils/competenciesOverview.utils";

import type { CompetencyReadiness } from "../competencies.types";
import type { OverviewView } from "../utils/competenciesOverview.utils";

export function useCompetenciesOverviewFilters() {
  const [trackFilter, setTrackFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<CompetencyReadiness | null>(null);
  const [view, setView] = useState<OverviewView>(OVERVIEW_VIEWS.LIST);
  const { pagination, setSearch, setPage, setPerPage } = usePaginationReducer({ perPage: 20 });

  const resetPage = () => setPage(1);
  const showAssignments = () => {
    setView(OVERVIEW_VIEWS.LIST);
    setStatusFilter(null);
  };

  const query = { ...pagination, trackFilter, statusFilter, view };
  const hasFilters = Boolean(pagination.search.trim() || trackFilter || statusFilter);

  return {
    query,
    hasFilters,
    ...pagination,
    trackFilter,
    setTrackFilter,
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
