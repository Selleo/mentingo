import { Info } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip";

import { REPORTS_HANDLES } from "../../../../e2e/data/reports/handles";
import { countConditions } from "../utils/reportFilters.utils";
import { formatReportDate } from "../utils/reports.utils";

import type { ReportConfiguration } from "../types/reports.types";

type ReportResultsHeaderProps = {
  applied: ReportConfiguration;
  capturedAt?: string;
  language: string;
};

export function ReportResultsHeader({ applied, capturedAt, language }: ReportResultsHeaderProps) {
  const { t } = useTranslation();
  const viewTitle = t(`reports.views.${applied.view}`);
  const resultTitle = applied.subject ? `${viewTitle} · ${applied.subject.name}` : viewTitle;
  const conditionsSummary = t("reports.results.activeConditions", {
    count: countConditions(applied.filters),
    groups: applied.groupIds.length,
  });
  const generatedAtSummary =
    capturedAt &&
    t("reports.results.generatedAt", {
      date: formatReportDate(capturedAt, language, applied.timezone),
    });

  return (
    <div>
      <div className="flex items-center gap-2">
        <h2 data-testid={REPORTS_HANDLES.RESULT_TITLE} className="h6 text-neutral-950">
          {resultTitle}
        </h2>
        <Tooltip>
          <TooltipTrigger
            type="button"
            aria-label={t("reports.help.title")}
            className="text-neutral-400 hover:text-neutral-700"
          >
            <Info className="size-4" />
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <p className="body-sm">{t("reports.help.scope")}</p>
            <p className="body-sm mt-2">{t("reports.help.metrics")}</p>
          </TooltipContent>
        </Tooltip>
      </div>
      <p className="details text-neutral-500">
        {conditionsSummary}
        {generatedAtSummary && ` · ${generatedAtSummary}`}
      </p>
    </div>
  );
}
