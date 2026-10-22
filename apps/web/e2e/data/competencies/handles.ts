export const COMPETENCIES_HANDLES = {
  PAGE: "competencies-page",
  OWN: "competencies-own-tab",
  DOCUMENTS: "competencies-documents-tab",
  DOCUMENT: (competencyId: string, conditionId: string) =>
    `competency-document-${competencyId}-${conditionId}`,
  PEOPLE: "competencies-people-tab",
  TEAM: "competencies-team-tab",
  MATRIX: "competencies-matrix-tab",
  REVIEW: "competencies-review-tab",
  PLANS: "competencies-plans-tab",
  PLAN_STEP: (competencyId: string, conditionId: string) =>
    `competency-plan-step-${competencyId}-${conditionId}`,
  CATALOG: "competencies-catalog-tab",
  CATALOG_CARD: (id: string) => `competency-catalog-card-${id}`,
  PROFILES: "competencies-profiles-tab",
  SETTINGS: "competencies-settings-tab",
  ROW: (id: string) => `competency-row-${id}`,
  ACTION: (id: string) => `competency-action-${id}`,
  EVIDENCE: (id: string) => `competency-evidence-${id}`,
} as const;
