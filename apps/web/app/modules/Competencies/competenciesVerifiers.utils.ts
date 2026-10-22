import type { CompetenciesWorkspace } from "./competencies.types";

export function canVerifyConditions(
  workspace: CompetenciesWorkspace,
  competencyId: string,
  conditionIds: string[],
  userId: string,
) {
  const conditions =
    workspace.catalog
      .find((item) => item.id === competencyId)
      ?.levels.flatMap((level) => level.conditions) ?? [];
  return (
    conditionIds.length > 0 &&
    conditionIds.every((id) => {
      const condition = conditions.find((item) => item.id === id);
      return (
        condition &&
        ["observation", "document"].includes(condition.kind) &&
        (condition.verifierIds ?? []).includes(userId)
      );
    })
  );
}
