import { match } from "ts-pattern";

import { COMPETENCY_READINESS } from "./competenciesReadiness.utils";

import type { CompetencyProfileItem, CompetencyReadiness } from "../competencies.types";
import type { CompetenciesOverviewQueryOptions } from "../hooks/competencies-hooks.types";

export const OVERVIEW_VIEWS = {
  LIST: "list",
  MATRIX: "matrix",
} as const;

export type OverviewView = (typeof OVERVIEW_VIEWS)[keyof typeof OVERVIEW_VIEWS];

export const tableHeadClassName = "details-md text-neutral-800";

export const STATUS_FILTERS: (CompetencyReadiness | null)[] = [
  null,
  COMPETENCY_READINESS.MET,
  COMPETENCY_READINESS.MISSING,
  COMPETENCY_READINESS.EXPIRING,
  COMPETENCY_READINESS.NO_PROFILE,
];

export const STATUS_DOT_CLASS_NAMES: Record<CompetencyReadiness, string> = {
  [COMPETENCY_READINESS.MET]: "bg-success-500",
  [COMPETENCY_READINESS.MISSING]: "bg-error-500",
  [COMPETENCY_READINESS.EXPIRING]: "bg-warning-500",
  [COMPETENCY_READINESS.NO_PROFILE]: "bg-neutral-400",
};

export const PROFILE_OPTIONS_PAGE = { page: 1, perPage: 100 };

export function buildOverviewQueries(
  options: CompetenciesOverviewQueryOptions,
  profiles: CompetencyProfileItem[],
) {
  const { page, perPage, search, profileFilter, statusFilter, view, canManage } = options;
  const matrixProfileId = profileFilter || profiles[0]?.id || "";
  const teamOnly = match(canManage)
    .with(true, () => undefined)
    .with(false, () => "true" as const)
    .exhaustive();
  const pagination = { page, perPage, search: search || undefined };

  return {
    people: {
      ...pagination,
      profileId: profileFilter || undefined,
      readiness: statusFilter ?? undefined,
      teamOnly,
    },
    matrix: { ...pagination, profileId: matrixProfileId, teamOnly },
    peopleEnabled: view === OVERVIEW_VIEWS.LIST,
    matrixEnabled: view === OVERVIEW_VIEWS.MATRIX && Boolean(matrixProfileId),
    activeProfileFilter: match(view)
      .with(OVERVIEW_VIEWS.LIST, () => profileFilter)
      .with(OVERVIEW_VIEWS.MATRIX, () => matrixProfileId)
      .exhaustive(),
  };
}

export function selectActiveOverviewQuery<TList, TMatrix>(
  view: OverviewView,
  list: TList,
  matrix: TMatrix,
) {
  return match(view)
    .with(OVERVIEW_VIEWS.LIST, () => list)
    .with(OVERVIEW_VIEWS.MATRIX, () => matrix)
    .exhaustive();
}
