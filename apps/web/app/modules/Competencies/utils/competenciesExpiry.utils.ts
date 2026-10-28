import type {
  Competency,
  CompetencyConditionAssessment,
  CompetencyStanding,
} from "../competencies.types";

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
  const currentIndex = definition.levels.findIndex((level) => level.id === standing.currentLevelId);
  if (currentIndex < 0) return [];
  const results = standing.levels.flatMap((level) => level.conditions);
  return definition.levels.slice(0, currentIndex + 1).flatMap((level, index) =>
    level.conditions.flatMap((condition) => {
      const result = results.find((item) => item.conditionId === condition.id);
      return result?.effectiveUntil && isConditionExpiring(result, asOf, warningDays)
        ? [{ condition, level: index + 1, effectiveUntil: result.effectiveUntil }]
        : [];
    }),
  );
}
