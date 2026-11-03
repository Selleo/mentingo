import { COMPETENCY_CONDITION_KINDS } from "./utils/competencyEditor.utils";

import type { CompetencyCondition, CompetencyConditionOverride } from "./competencies.types";

export const COMPETENCY_OVERRIDE_STATUSES = {
  AUTOMATIC: "automatic",
  MET: "met",
} as const satisfies Record<string, CompetencyConditionOverride["status"]>;

export const COMPETENCY_AUTOMATIC_CONFIRMATION_TITLE_KEYS = {
  [COMPETENCY_CONDITION_KINDS.COURSE]: "competencies.detailGuide.automaticCourse",
  [COMPETENCY_CONDITION_KINDS.DOCUMENT]: "competencies.detailGuide.automaticDocument",
  [COMPETENCY_CONDITION_KINDS.OBSERVATION]: "competencies.detailGuide.automaticObservation",
} as const satisfies Record<CompetencyCondition["kind"], string>;
