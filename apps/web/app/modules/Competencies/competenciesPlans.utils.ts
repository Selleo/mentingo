import type { CompetenciesWorkspace } from "./competencies.types";

export function getSubjectPlanActions(workspace: CompetenciesWorkspace, subjectId: string) {
  const requirements = workspace.assessments.find(
    (assessment) => assessment.subjectId === subjectId,
  )?.requirements;
  return workspace.actions.filter((action) => {
    if (action.subjectId !== subjectId || action.status === "cancelled") return false;
    const requirement = requirements?.find(
      (item) => item.requirement.competencyId === action.competencyId,
    )?.requirement;
    const definition = workspace.catalog.find((item) => item.id === action.competencyId);
    if (!requirement || !definition || definition.archived) return false;
    const targetIndex = definition.levels.findIndex((level) => level.id === action.levelId);
    const requiredIndex = definition.levels.findIndex((level) => level.id === requirement.levelId);
    return targetIndex >= 0 && targetIndex <= requiredIndex;
  });
}

export function getSubjectRequiredSteps(workspace: CompetenciesWorkspace, subjectId: string) {
  const assessment = workspace.assessments.find((item) => item.subjectId === subjectId);
  return (assessment?.requirements ?? []).flatMap(({ requirement, standing }) => {
    const definition = workspace.catalog.find((item) => item.id === requirement.competencyId);
    if (!definition || definition.archived) return [];
    const requiredIndex = definition.levels.findIndex((level) => level.id === requirement.levelId);
    return definition.levels.slice(0, requiredIndex + 1).flatMap((level) =>
      level.conditions.flatMap((condition) => {
        const result = standing.levels
          .find((result) => result.levelId === level.id)
          ?.conditions.find((result) => result.conditionId === condition.id);
        if (result?.met) return [];
        return [
          {
            definition,
            level,
            condition,
            pending: result?.reason === "pending",
          },
        ];
      }),
    );
  });
}

export function getSubjectDocumentSteps(workspace: CompetenciesWorkspace, subjectId: string) {
  const steps = getSubjectRequiredSteps(workspace, subjectId).filter(
    (step) => step.condition.kind === "document",
  );
  const included = new Set(steps.map((step) => `${step.definition.id}:${step.condition.id}`));
  const pending = new Set(
    workspace.evidence
      .filter(
        (item) =>
          item.subjectId === subjectId && item.kind === "document" && item.status === "pending",
      )
      .flatMap((item) => item.conditionIds.map((id) => `${item.competencyId}:${id}`)),
  );
  for (const { standing } of workspace.standings.filter(
    (item) => item.subjectId === subjectId && item.standing.expiring,
  )) {
    const definition = workspace.catalog.find((item) => item.id === standing.competencyId);
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
