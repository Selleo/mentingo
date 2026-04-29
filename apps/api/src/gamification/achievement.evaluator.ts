import type { UUIDType } from "src/common";

export type AchievementEvaluationCatalogItem = {
  id: UUIDType;
  pointThreshold: number;
};

export function evaluateAchievementUnlocks(
  currentTotal: number,
  heldAchievementIds: Iterable<UUIDType>,
  activeCatalog: AchievementEvaluationCatalogItem[],
): UUIDType[] {
  const heldIds = new Set(heldAchievementIds);

  return activeCatalog
    .filter((achievement) => currentTotal >= achievement.pointThreshold)
    .filter((achievement) => !heldIds.has(achievement.id))
    .map((achievement) => achievement.id);
}
