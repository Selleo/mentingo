import {
  COMPETENCY_AUTOMATIC_CONFIRMATION_TITLE_KEYS,
  COMPETENCY_OVERRIDE_STATUSES,
} from "../competencyOverrides.constants";

import { getConditionGuidanceKey } from "./competencySubject.utils";

import type { CompetencyCondition } from "../competencies.types";

export function getCompetencyOverrideOptions(condition: CompetencyCondition) {
  return [
    {
      value: COMPETENCY_OVERRIDE_STATUSES.AUTOMATIC,
      titleKey: COMPETENCY_AUTOMATIC_CONFIRMATION_TITLE_KEYS[condition.kind],
      descriptionKey: getConditionGuidanceKey(condition),
    },
    {
      value: COMPETENCY_OVERRIDE_STATUSES.MET,
      titleKey: "competencies.detailGuide.confirmManually",
      descriptionKey: "competencies.detailGuide.confirmManuallyHelp",
    },
  ] as const;
}
