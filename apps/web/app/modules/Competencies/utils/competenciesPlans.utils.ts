import type { CompetencySubjectWorkspace } from "../competencies.types";

export function getSubjectRequiredSteps(workspace: CompetencySubjectWorkspace) {
  return (workspace.assessment?.requirements ?? []).flatMap(({ requirement, standing }) => {
    const definition = workspace.competencies.find((item) => item.id === requirement.competencyId);
    if (!definition || definition.archived) return [];
    const requiredIndex = definition.levels.findIndex((level) => level.id === requirement.levelId);
    return definition.levels.slice(0, requiredIndex + 1).flatMap((level) =>
      level.conditions.flatMap((condition) => {
        const result = standing.levels
          .find((result) => result.levelId === level.id)
          ?.conditions.find((result) => result.conditionId === condition.id);
        if (result?.met) return [];
        return [{ definition, level, condition, pending: result?.reason === "pending" }];
      }),
    );
  });
}

/** Documents a person still has to submit, including renewals of attained levels about to expire. */
export function getSubjectDocumentSteps(workspace: CompetencySubjectWorkspace) {
  const steps = getSubjectRequiredSteps(workspace).filter(
    (step) => step.condition.kind === "document",
  );
  const included = new Set(steps.map((step) => `${step.definition.id}:${step.condition.id}`));
  const pending = new Set(
    workspace.evidence
      .filter((item) => item.kind === "document" && item.status === "pending")
      .flatMap((item) => item.conditionIds.map((id) => `${item.competencyId}:${id}`)),
  );
  for (const standing of workspace.standings.filter((item) => item.expiring)) {
    const definition = workspace.competencies.find((item) => item.id === standing.competencyId);
    if (!definition || definition.archived) continue;
    const currentIndex = definition.levels.findIndex(
      (level) => level.id === standing.currentLevelId,
    );
    for (const level of definition.levels.slice(0, currentIndex + 1)) {
      for (const condition of level.conditions) {
        const key = `${definition.id}:${condition.id}`;
        if (condition.kind !== "document" || included.has(key)) continue;
        included.add(key);
        steps.push({ definition, level, condition, pending: false });
      }
    }
  }
  return steps.map((step) => ({
    ...step,
    pending: step.pending || pending.has(`${step.definition.id}:${step.condition.id}`),
  }));
}
