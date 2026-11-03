import { useTranslation } from "react-i18next";
import { match } from "ts-pattern";

import { Badge } from "~/components/ui/badge";

import { COMPETENCY_READINESS } from "../utils/competenciesReadiness.utils";

import type { CompetencyPersonReadiness } from "../competencies.types";

export function CompetencyReadinessBadge({
  readiness,
}: {
  readiness: Pick<CompetencyPersonReadiness, "readiness" | "metCount" | "requirementCount">;
}) {
  const { t } = useTranslation();
  const missingCount = readiness.requirementCount - readiness.metCount;

  return match(readiness.readiness)
    .with(COMPETENCY_READINESS.MET, () => (
      <Badge variant="success" className="w-fit whitespace-nowrap text-xs">
        {t("competencies.readiness.ready")}
      </Badge>
    ))
    .with(COMPETENCY_READINESS.EXPIRING, () => (
      <Badge variant="inProgress" className="w-fit whitespace-nowrap text-xs">
        {t("competencies.readiness.expiring")}
      </Badge>
    ))
    .with(COMPETENCY_READINESS.MISSING, () => (
      <Badge className="w-fit whitespace-nowrap border border-error-200 bg-error-50 text-xs text-error-700">
        {t("competencies.readiness.missingCount", { count: missingCount })}
      </Badge>
    ))
    .with(COMPETENCY_READINESS.NO_PROFILE, () => (
      <Badge variant="notStarted" className="w-fit whitespace-nowrap text-xs">
        {t("competencies.readiness.noProfile")}
      </Badge>
    ))
    .exhaustive();
}
