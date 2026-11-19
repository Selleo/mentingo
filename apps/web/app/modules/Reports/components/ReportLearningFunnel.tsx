import { Filter } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Progress } from "~/components/ui/progress";

import { LEARNING_FUNNEL_STEPS } from "../constants/reportCharts.constants";
import { formatReportPercent } from "../utils/reports.utils";

import type { ReportLearningInsights } from "../types/reportCharts.types";

type ReportLearningFunnelProps = {
  funnel: ReportLearningInsights["funnel"];
};

export function ReportLearningFunnel({ funnel }: ReportLearningFunnelProps) {
  const { t } = useTranslation();

  return (
    <section className="flex min-w-0 flex-col rounded-lg border border-neutral-200 bg-white p-5">
      <h3 className="body-base-md flex items-center gap-2 text-neutral-950">
        <Filter className="size-4 text-neutral-500" aria-hidden="true" />
        {t("reports.insights.funnel")}
      </h3>
      <p className="details text-neutral-500">{t("reports.insights.funnelSubtitle")}</p>
      <ol className="mt-auto grid grid-cols-2 gap-3 pt-4 sm:grid-cols-4">
        {LEARNING_FUNNEL_STEPS.map((step) => {
          const share = funnel.learners ? (funnel[step] * 100) / funnel.learners : 0;
          return (
            <li key={step} className="flex flex-col gap-1 rounded-lg bg-neutral-50 p-3">
              <span className="h5 text-neutral-950">{funnel[step]}</span>
              <span className="details text-neutral-600">
                {t(`reports.insights.funnelSteps.${step}`)}
              </span>
              <Progress
                value={share}
                aria-hidden
                className="mt-1 h-1.5 bg-neutral-200"
                indicatorClassName="bg-primary-600"
              />
              <span className="details text-neutral-500">{formatReportPercent(share)}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
