import { CONDITION_KINDS, type CompetencySubjectWorkspace } from "@mentingo/competencies-sdk";

export function hasCourseConditions(workspace: CompetencySubjectWorkspace): boolean {
  for (const competency of workspace.competencies) {
    for (const level of competency.levels) {
      if (level.conditions.some((condition) => condition.kind === CONDITION_KINDS.COURSE))
        return true;
    }
  }
  return false;
}

export function getWorkspaceContributorIds(workspace: CompetencySubjectWorkspace): string[] {
  const contributorIds = new Set<string>();
  for (const evidence of workspace.evidence) {
    contributorIds.add(evidence.createdBy);
    if (evidence.reviewedBy) contributorIds.add(evidence.reviewedBy);
  }
  for (const override of workspace.overrides) contributorIds.add(override.createdBy);
  for (const revocation of workspace.revocations) contributorIds.add(revocation.revokedBy);
  return [...contributorIds];
}
