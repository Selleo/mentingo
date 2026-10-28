import { useTranslation } from "react-i18next";

import type { CompetencyLevel } from "../competencies.types";

type CompetencyDetailSummaryProps = {
  current: CompetencyLevel | undefined;
  nextLevel: CompetencyLevel | undefined;
  requiredLevel: CompetencyLevel | undefined;
};

export function CompetencyDetailSummary({
  current,
  nextLevel,
  requiredLevel,
}: CompetencyDetailSummaryProps) {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <dl className="grid gap-4 rounded-lg bg-neutral-50 p-4 sm:grid-cols-2">
        <div className="space-y-1">
          <dt className="text-xs font-medium text-neutral-700">{t("competencies.currentLevel")}</dt>
          <dd className="font-semibold text-neutral-950">{current?.name ?? "-"}</dd>
        </div>
        {requiredLevel && (
          <div className="space-y-1">
            <dt className="text-xs font-medium text-neutral-700">
              {t("competencies.requiredLevel")}
            </dt>
            <dd className="font-semibold text-neutral-950">{requiredLevel.name}</dd>
          </div>
        )}
      </dl>
      <div className="space-y-1 border-l-2 border-primary-600 pl-3">
        <p className="body-sm-md text-neutral-950">
          {nextLevel
            ? t("competencies.detailGuide.nextLevel", { level: nextLevel.name })
            : t("competencies.detailGuide.allConfirmed")}
        </p>
        <p className="body-sm text-neutral-800">{t("competencies.detailGuide.levelHelp")}</p>
      </div>
    </div>
  );
}
