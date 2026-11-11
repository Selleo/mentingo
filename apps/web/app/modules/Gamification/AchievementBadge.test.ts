import { describe, expect, it } from "vitest";

import {
  getAchievementBadgeUrl,
  getClosestBadgeColor,
  type AchievementBadgeColor,
} from "./AchievementBadge";

const COLORS: AchievementBadgeColor[] = [
  "mentingo",
  "blue",
  "dark_blue",
  "indigo",
  "cyan",
  "teal",
  "green",
  "amber",
  "orange",
  "red",
  "pink",
  "magenta",
];

describe("getAchievementBadgeUrl", () => {
  it("has a tier asset for every badge colour and level", () => {
    for (const color of COLORS) {
      for (const level of [1, 2, 3]) {
        expect(getAchievementBadgeUrl(color, level), `${color}/${level}`).toMatch(
          new RegExp(`${color}/tier_${level}\\.svg`),
        );
      }
    }
  });

  it("clamps levels outside the three tiers", () => {
    expect(getAchievementBadgeUrl("red", 0)).toMatch(/tier_1\.svg/);
    expect(getAchievementBadgeUrl("red", 7)).toMatch(/tier_3\.svg/);
  });
});

describe("getClosestBadgeColor", () => {
  it.each([
    ["#3f58b6", "dark_blue"],
    ["#d32f2f", "red"],
    ["#2e7d32", "green"],
    ["#f59e0b", "amber"],
    ["#7c3aed", "indigo"],
  ])("matches %s to %s", (primaryColor, expected) => {
    expect(getClosestBadgeColor(primaryColor)).toBe(expected);
  });

  it.each(["#777777", "", "rgb(1, 2, 3)"])("falls back to the default for %j", (primaryColor) => {
    expect(getClosestBadgeColor(primaryColor)).toBe("mentingo");
  });
});
