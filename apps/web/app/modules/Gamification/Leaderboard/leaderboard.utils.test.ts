import { LEADERBOARD_METRICS, LEADERBOARD_PERIODS } from "@repo/shared";
import { describe, expect, it } from "vitest";

import {
  areLeaderboardsEnabled,
  buildLeaderboardQuery,
  getDefaultScope,
  isRangeReversed,
  resolveScope,
  shouldShowNearby,
  TENANT_SCOPE,
  type Leaderboard,
} from "./leaderboard.utils";

const filters = {
  scope: TENANT_SCOPE,
  metric: LEADERBOARD_METRICS.XP,
  period: LEADERBOARD_PERIODS.WEEK,
  from: "",
  to: "",
};

const entry = (userId: string, rank: number) => ({
  userId,
  firstName: userId,
  lastName: "",
  score: 0,
  rank,
});

describe("leaderboard utils", () => {
  it("enables leaderboards only while gamification is on too", () => {
    expect(areLeaderboardsEnabled({ gamificationEnabled: true, leaderboardsEnabled: true })).toBe(
      true,
    );
    expect(areLeaderboardsEnabled({ gamificationEnabled: false, leaderboardsEnabled: true })).toBe(
      false,
    );
    expect(areLeaderboardsEnabled({ gamificationEnabled: true, leaderboardsEnabled: false })).toBe(
      false,
    );
    expect(areLeaderboardsEnabled(undefined)).toBe(false);
  });

  it("defaults to the organization when it is visible, otherwise to the first group", () => {
    const groups = [{ id: "group-1", name: "Alpha" }];

    expect(getDefaultScope({ tenantWide: true, groups })).toBe(TENANT_SCOPE);
    expect(getDefaultScope({ tenantWide: false, groups })).toBe("group-1");
    expect(getDefaultScope({ tenantWide: false, groups: [] })).toBeNull();
  });

  it("keeps the chosen scope only while it is still allowed", () => {
    const groups = [{ id: "group-1", name: "Alpha" }];

    expect(resolveScope("group-1", { tenantWide: false, groups })).toBe("group-1");
    expect(resolveScope(TENANT_SCOPE, { tenantWide: true, groups })).toBe(TENANT_SCOPE);
    expect(resolveScope(TENANT_SCOPE, { tenantWide: false, groups })).toBe("group-1");
    expect(resolveScope("group-left", { tenantWide: true, groups })).toBe(TENANT_SCOPE);
    expect(resolveScope("group-left", { tenantWide: false, groups: [] })).toBeNull();
    expect(resolveScope(null, { tenantWide: false, groups })).toBe("group-1");
  });

  it("flags a reversed custom range but not an incomplete one", () => {
    const custom = { ...filters, period: LEADERBOARD_PERIODS.CUSTOM };

    expect(isRangeReversed({ ...custom, from: "2026-11-05", to: "2026-11-01" })).toBe(true);
    expect(isRangeReversed({ ...custom, from: "2026-11-05" })).toBe(false);
    expect(isRangeReversed({ ...custom, from: "2026-11-01", to: "2026-11-01" })).toBe(false);
    expect(isRangeReversed({ ...filters, from: "2026-11-05", to: "2026-11-01" })).toBe(false);
  });

  it("omits the group for the organization and the dates outside custom periods", () => {
    expect(buildLeaderboardQuery({ ...filters, from: "2026-11-01" })).toEqual({
      metric: LEADERBOARD_METRICS.XP,
      period: LEADERBOARD_PERIODS.WEEK,
      groupId: undefined,
    });
    expect(buildLeaderboardQuery({ ...filters, scope: "group-1" })?.groupId).toBe("group-1");
  });

  it("waits for a complete, ordered custom range", () => {
    const custom = { ...filters, period: LEADERBOARD_PERIODS.CUSTOM };

    expect(buildLeaderboardQuery({ ...custom, from: "2026-11-01" })).toBeNull();
    expect(buildLeaderboardQuery({ ...custom, from: "2026-11-05", to: "2026-11-01" })).toBeNull();
    expect(
      buildLeaderboardQuery({ ...custom, from: "2026-11-01", to: "2026-11-05" }),
    ).toMatchObject({ from: "2026-11-01", to: "2026-11-05" });
  });

  it("shows nearby users only when the viewer is ranked outside the top list", () => {
    const leaderboard = (currentUser: ReturnType<typeof entry> | null) =>
      ({ entries: [entry("a", 1)], currentUser, nearby: [] }) as unknown as Leaderboard;

    expect(shouldShowNearby(leaderboard(entry("a", 1)))).toBe(false);
    expect(shouldShowNearby(leaderboard(entry("z", 14)))).toBe(true);
    expect(shouldShowNearby(leaderboard(null))).toBe(false);
  });
});
