import { getLevelFromXp, getXpRequiredForLevel } from "@repo/shared";

describe("gamification levels", () => {
  it.each([
    [0, 1],
    [99, 1],
    [100, 2],
    [399, 2],
    [400, 3],
    [900, 4],
  ])("maps %i lifetime XP to level %i", (lifetimeXp, level) => {
    expect(getLevelFromXp(lifetimeXp)).toBe(level);
  });

  it("requires 100 x (N - 1)^2 XP to reach level N", () => {
    expect([1, 2, 3, 4].map(getXpRequiredForLevel)).toEqual([0, 100, 400, 900]);
  });
});
