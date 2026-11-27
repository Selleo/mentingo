import { match } from "ts-pattern";

import { COMPETENCY_READINESS } from "./competenciesReadiness.utils";

import type {
  CompetencyPersonTrack,
  CompetencyTrackItem,
  CompetencyReadiness,
} from "../competencies.types";
import type { CompetenciesOverviewQueryOptions } from "../hooks/competencies-hooks.types";

export const OVERVIEW_VIEWS = {
  LIST: "list",
  MATRIX: "matrix",
} as const;

export type OverviewView = (typeof OVERVIEW_VIEWS)[keyof typeof OVERVIEW_VIEWS];

export const tableHeadClassName = "details-md text-neutral-800";

export const formatTrackNames = (tracks: CompetencyPersonTrack[]) =>
  tracks.map((track) => track.name).join(", ");

export const STATUS_FILTERS: (CompetencyReadiness | null)[] = [
  null,
  COMPETENCY_READINESS.MET,
  COMPETENCY_READINESS.MISSING,
  COMPETENCY_READINESS.EXPIRING,
  COMPETENCY_READINESS.NO_TRACK,
];

export const STATUS_DOT_CLASS_NAMES: Record<CompetencyReadiness, string> = {
  [COMPETENCY_READINESS.MET]: "bg-success-500",
  [COMPETENCY_READINESS.MISSING]: "bg-error-500",
  [COMPETENCY_READINESS.EXPIRING]: "bg-warning-500",
  [COMPETENCY_READINESS.NO_TRACK]: "bg-neutral-400",
};

export function buildOverviewQueries(
  options: CompetenciesOverviewQueryOptions,
  tracks: CompetencyTrackItem[],
) {
  const { page, perPage, search, trackFilter, statusFilter, view, canManage } = options;
  const matrixTrackId = trackFilter || tracks[0]?.id || "";
  const teamOnly = match(canManage)
    .with(true, () => undefined)
    .with(false, () => "true" as const)
    .exhaustive();
  const pagination = { page, perPage, search: search || undefined };

  return {
    people: {
      ...pagination,
      trackId: trackFilter || undefined,
      readiness: statusFilter ?? undefined,
      teamOnly,
    },
    matrix: { ...pagination, trackId: matrixTrackId, teamOnly },
    peopleEnabled: view === OVERVIEW_VIEWS.LIST,
    matrixEnabled: view === OVERVIEW_VIEWS.MATRIX && Boolean(matrixTrackId),
    activeTrackFilter: match(view)
      .with(OVERVIEW_VIEWS.LIST, () => trackFilter)
      .with(OVERVIEW_VIEWS.MATRIX, () => matrixTrackId)
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
