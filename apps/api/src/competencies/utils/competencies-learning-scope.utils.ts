import { COMPETENCIES_JOB_OPERATIONS } from "../competencies.constants";

import type { CompetenciesLearningScope } from "../competencies.types";

export function deduplicateLearningScopes(
  scopes: CompetenciesLearningScope[],
): CompetenciesLearningScope[] {
  const uniqueScopes = new Map<string, CompetenciesLearningScope>();
  for (const scope of scopes) uniqueScopes.set(`${scope.subjectId}:${scope.courseId}`, scope);
  return [...uniqueScopes.values()];
}

export function getLearningFactsJobId(
  tenantId: string,
  subjectId: string,
  courseId: string,
  eventId?: string,
): string {
  const parts = [COMPETENCIES_JOB_OPERATIONS.SYNC, tenantId, subjectId, courseId];
  if (eventId) parts.push(eventId);
  return parts.join("-");
}
