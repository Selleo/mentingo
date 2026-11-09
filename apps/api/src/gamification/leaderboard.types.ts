import type { LeaderboardMetric, LeaderboardPeriod } from "@repo/shared";
import type { UUIDType } from "src/common";

/** `null` means unbounded; `startsAt` is inclusive and `endsAt` exclusive. */
export type LeaderboardRange = {
  startsAt: Date | null;
  endsAt: Date | null;
};

export type LeaderboardQuery = {
  metric: LeaderboardMetric;
  period: LeaderboardPeriod;
  from?: string;
  to?: string;
  groupId?: UUIDType;
};

export type LeaderboardRankingOptions = LeaderboardRange & {
  metric: LeaderboardMetric;
  groupId: UUIDType | null;
  viewerId: UUIDType;
  topLimit: number;
  nearbyDistance: number;
};

export type LeaderboardRow = {
  userId: UUIDType;
  firstName: string;
  lastName: string;
  score: number;
  /** Shared on ties (1, 1, 3); shown to users. */
  rank: number;
  /** Unique row order (1, 2, 3); decides the top list and the viewer's neighbours. */
  position: number;
};
