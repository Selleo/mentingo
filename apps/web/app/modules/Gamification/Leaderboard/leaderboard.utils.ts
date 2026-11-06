import { LEADERBOARD_PERIODS, type LeaderboardMetric, type LeaderboardPeriod } from "@repo/shared";

import type { GetLeaderboardResponse, GetLeaderboardScopesResponse } from "~/api/generated-api";
import type { LeaderboardQuery } from "~/api/queries/useLeaderboard";

export type Leaderboard = GetLeaderboardResponse["data"];
export type LeaderboardScopes = GetLeaderboardScopesResponse["data"];

/** Leaderboards need gamification on as well; the API rejects them otherwise. */
export const areLeaderboardsEnabled = (
  settings?: { gamificationEnabled?: boolean; leaderboardsEnabled?: boolean } | null,
) => Boolean(settings?.gamificationEnabled && settings?.leaderboardsEnabled);

/** Select value for the organization-wide leaderboard; every other value is a group id. */
export const TENANT_SCOPE = "tenant";

export type LeaderboardFilters = {
  scope: string;
  metric: LeaderboardMetric;
  period: LeaderboardPeriod;
  from: string;
  to: string;
};

export const getDefaultScope = ({ tenantWide, groups }: LeaderboardScopes) => {
  if (tenantWide) return TENANT_SCOPE;

  return groups[0]?.id ?? null;
};

/** Keeps the chosen scope only while it is still allowed, e.g. after leaving a group. */
export const resolveScope = (selected: string | null, scopes: LeaderboardScopes) => {
  const isAvailable =
    selected === TENANT_SCOPE ? scopes.tenantWide : scopes.groups.some(({ id }) => id === selected);

  return selected && isAvailable ? selected : getDefaultScope(scopes);
};

export const isRangeReversed = ({ period, from, to }: LeaderboardFilters) =>
  period === LEADERBOARD_PERIODS.CUSTOM && Boolean(from && to) && from > to;

/** Returns null while a custom range is incomplete or reversed, so no request is sent. */
export const buildLeaderboardQuery = ({
  scope,
  metric,
  period,
  from,
  to,
}: LeaderboardFilters): LeaderboardQuery | null => {
  const groupId = scope === TENANT_SCOPE ? undefined : scope;

  if (period !== LEADERBOARD_PERIODS.CUSTOM) return { metric, period, groupId };
  if (!from || !to || from > to) return null;

  return { metric, period, groupId, from, to };
};

/** Nearby users are shown only when the viewer is not in the top list. */
export const shouldShowNearby = ({ entries, currentUser }: Leaderboard) =>
  Boolean(currentUser) && !entries.some(({ userId }) => userId === currentUser?.userId);
