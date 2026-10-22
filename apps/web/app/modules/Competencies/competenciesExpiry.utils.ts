import type {
  Competency,
  CompetencyConditionAssessment,
  CompetencyStanding,
} from "./competencies.types";

export function isConditionExpiring(
  result: CompetencyConditionAssessment | undefined,
  asOf: string,
  warningDays: number | null,
) {
  if (!result?.met || !result.effectiveUntil || warningDays === null) return false;
  const remaining = Date.parse(result.effectiveUntil) - Date.parse(asOf);
  return remaining > 0 && remaining <= warningDays * 86400000;
}

export function getExpiringConditions(
  definition: Competency,
  standing: CompetencyStanding,
  asOf: string,
  warningDays: number | null,
) {
  const current = standing.levels.find((level) => level.levelId === standing.currentLevelId);
  if (!current) return [];
  return definition.levels.flatMap((level, index) =>
    level.conditions.flatMap((condition) => {
      const result = current.conditions.find((item) => item.conditionId === condition.id);
      return result?.effectiveUntil && isConditionExpiring(result, asOf, warningDays)
        ? [{ condition, level: index + 1, effectiveUntil: result.effectiveUntil }]
        : [];
    }),
  );
}
