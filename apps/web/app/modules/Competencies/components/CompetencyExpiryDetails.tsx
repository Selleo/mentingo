import { useTranslation } from "react-i18next";

import { formatLocalizedDate } from "~/utils/formatLocalizedDate";

import { getExpiringConditions } from "../competenciesExpiry.utils";

import type { CompetenciesWorkspace, Competency, CompetencyStanding } from "../competencies.types";

export function CompetencyExpiryDetails({
  definition,
  standing,
  workspace,
}: {
  definition: Competency;
  standing: CompetencyStanding;
  workspace: CompetenciesWorkspace;
}) {
  const { t, i18n } = useTranslation();
  const conditions = getExpiringConditions(
    definition,
    standing,
    workspace.asOf,
    workspace.warningDays,
  );
  if (!conditions.length) return null;
  return (
    <ul
      aria-label={`${t("competencies.expiring")}: ${definition.name}`}
      className="mt-2 space-y-2 text-xs leading-relaxed"
    >
      {conditions.map(({ condition, level, effectiveUntil }) => (
        <li key={condition.id} className="break-words">
          <span className="font-medium">
            {t("competencies.levelNumber", { number: level })}
            {" - "}
            {t(`competencies.kind.${condition.kind}`)}: {condition.description}
          </span>
          <span className="block">
            {t("competencies.expiresOn", {
              date: formatLocalizedDate(i18n.language, effectiveUntil),
            })}
          </span>
        </li>
      ))}
    </ul>
  );
}
