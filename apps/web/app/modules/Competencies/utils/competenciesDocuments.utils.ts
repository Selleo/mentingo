import type {
  CompetencyDocumentGroup,
  CompetencyDocumentStep,
  CompetencyEvidence,
  CompetencySubjectWorkspace,
} from "../competencies.types";

export const SUBMITTED_DOCUMENTS_PAGE = { page: 1, perPage: 100 };

export const countBadgeClassName =
  "flex size-6 items-center justify-center rounded-full text-xs font-semibold";

export function getDocumentLevelIndex(group: CompetencyDocumentGroup, levelId: string) {
  return group.definition.levels.findIndex((level) => level.id === levelId);
}

export function groupSubjectDocuments(
  workspace: CompetencySubjectWorkspace,
  required: CompetencyDocumentStep[],
  submissions: CompetencyEvidence[],
): CompetencyDocumentGroup[] {
  const groups: CompetencyDocumentGroup[] = [];
  const groupFor = (competencyId: string) => {
    const existing = groups.find((group) => group.definition.id === competencyId);
    if (existing) return existing;
    const definition = workspace.competencies.find((item) => item.id === competencyId);
    if (!definition) return undefined;
    const group: CompetencyDocumentGroup = { definition, steps: [], submissions: [] };
    groups.push(group);
    return group;
  };
  for (const step of required) groupFor(step.definition.id)?.steps.push(step);
  for (const record of submissions) groupFor(record.competencyId)?.submissions.push(record);
  for (const group of groups)
    group.steps.sort(
      (left, right) =>
        getDocumentLevelIndex(group, left.level.id) - getDocumentLevelIndex(group, right.level.id),
    );

  return groups;
}
