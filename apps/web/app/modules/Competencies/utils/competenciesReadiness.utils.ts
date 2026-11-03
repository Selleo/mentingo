import type { CompetenciesSummary, CompetencyReadiness } from "../competencies.types";

/** Readiness values computed by the competencies plugin for each person. */
export const COMPETENCY_READINESS = {
  MET: "met",
  MISSING: "missing",
  EXPIRING: "expiring",
  NO_PROFILE: "no_profile",
} as const satisfies Record<string, CompetencyReadiness>;

/** Translation keys under `competencies.readiness` for each readiness value. */
export const READINESS_TRANSLATION_KEYS: Record<CompetencyReadiness, string> = {
  [COMPETENCY_READINESS.MET]: "ready",
  [COMPETENCY_READINESS.MISSING]: "gaps",
  [COMPETENCY_READINESS.EXPIRING]: "expiring",
  [COMPETENCY_READINESS.NO_PROFILE]: "noProfile",
};

export const COMPETENCIES_SETUP_STEPS = {
  CATEGORIES: "categories",
  COMPETENCIES: "competencies",
  PROFILES: "profiles",
  ASSIGNMENTS: "assignments",
} as const;

export type CompetenciesSetupStep =
  (typeof COMPETENCIES_SETUP_STEPS)[keyof typeof COMPETENCIES_SETUP_STEPS];

export const COMPETENCIES_SETUP_STEP_ORDER = Object.values(COMPETENCIES_SETUP_STEPS);

export function getCompetenciesSetupProgress(summary: CompetenciesSummary, categoryCount: number) {
  return {
    [COMPETENCIES_SETUP_STEPS.CATEGORIES]: categoryCount > 0,
    [COMPETENCIES_SETUP_STEPS.COMPETENCIES]: summary.setup.competencies > 0,
    [COMPETENCIES_SETUP_STEPS.PROFILES]: summary.setup.profiles > 0,
    [COMPETENCIES_SETUP_STEPS.ASSIGNMENTS]: summary.setup.assignments > 0,
  } satisfies Record<CompetenciesSetupStep, boolean>;
}
