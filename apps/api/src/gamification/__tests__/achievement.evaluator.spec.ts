import { evaluateAchievementUnlocks } from "src/gamification/achievement.evaluator";

import type { UUIDType } from "src/common";

const achievement = (id: string, pointThreshold: number) => ({
  id: id as UUIDType,
  pointThreshold,
});

describe("evaluateAchievementUnlocks", () => {
  it("returns every newly qualifying achievement when one award crosses multiple thresholds", () => {
    const catalog = [achievement("a", 10), achievement("b", 25), achievement("c", 50)];

    expect(evaluateAchievementUnlocks(30, [], catalog)).toEqual(["a", "b"]);
  });

  it("does not return achievements that are already held", () => {
    const catalog = [achievement("a", 10), achievement("b", 25)];

    expect(evaluateAchievementUnlocks(30, ["a" as UUIDType], catalog)).toEqual(["b"]);
  });

  it("treats threshold equality as qualifying", () => {
    const catalog = [achievement("a", 30), achievement("b", 31)];

    expect(evaluateAchievementUnlocks(30, [], catalog)).toEqual(["a"]);
  });

  it("cannot unlock soft-deleted achievements when they are excluded from the active catalog", () => {
    const activeCatalog = [achievement("active", 10)];

    expect(evaluateAchievementUnlocks(100, [], activeCatalog)).toEqual(["active"]);
  });
});
