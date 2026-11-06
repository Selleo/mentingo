import { describe, expect, it } from "vitest";

import { getAchievementProgress, getLevelProgress } from "./gamification.utils";

import type { UserAchievement, UserGamificationProfile } from "./gamification.types";

const profile = (lifetimeXp: number) =>
  ({ lifetimeXp, currentLevelXp: 100, nextLevelXp: 400, level: 2 }) as UserGamificationProfile;

const achievement = (progress: number, earnedThresholds: number[]) =>
  ({
    progress,
    levels: [5, 25, 50].map((threshold, index) => ({
      level: index + 1,
      threshold,
      xpReward: 10,
      earnedAt: earnedThresholds.includes(threshold) ? "2026-11-01T00:00:00Z" : null,
    })),
  }) as UserAchievement;

describe("gamification utils", () => {
  it("measures progress within the current level", () => {
    expect(getLevelProgress(profile(250))).toEqual({ percent: 50, remainingXp: 150 });
  });

  it("handles level 1 and the exact level boundary", () => {
    const levelOne = { lifetimeXp: 0, currentLevelXp: 0, nextLevelXp: 100, level: 1 };

    expect(getLevelProgress(levelOne as UserGamificationProfile)).toEqual({
      percent: 0,
      remainingXp: 100,
    });
    expect(getLevelProgress(profile(400))).toEqual({ percent: 100, remainingXp: 0 });
  });

  it("tracks the next unearned achievement level", () => {
    const result = getAchievementProgress(achievement(10, [5]));

    expect(result).toMatchObject({ earnedLevelCount: 1, percent: 40 });
    expect(result.nextLevel?.threshold).toBe(25);
  });

  it("reports a fully earned achievement as complete", () => {
    const result = getAchievementProgress(achievement(80, [5, 25, 50]));

    expect(result).toMatchObject({ earnedLevelCount: 3, percent: 100, nextLevel: undefined });
  });
});
