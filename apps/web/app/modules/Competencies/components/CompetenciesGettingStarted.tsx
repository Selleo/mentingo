import { Check } from "lucide-react";
import { useId } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Progress } from "~/components/ui/progress";
import { cn } from "~/lib/utils";

import { COMPETENCIES_HANDLES } from "../../../../e2e/data/competencies/handles";
import { useCompetenciesSetupProgress } from "../hooks/useCompetenciesSetupProgress";
import { COMPETENCIES_SETUP_STEP_ORDER } from "../utils/competenciesReadiness.utils";

import type { CompetenciesSummary } from "../competencies.types";
import type { CompetenciesSetupStep } from "../utils/competenciesReadiness.utils";

export function CompetenciesGettingStarted({
  summary,
  onStepStart,
}: {
  summary: CompetenciesSummary;
  onStepStart: (step: CompetenciesSetupStep) => void;
}) {
  const { t } = useTranslation();
  const titleId = useId();
  const { progress } = useCompetenciesSetupProgress(summary);
  const completedCount = COMPETENCIES_SETUP_STEP_ORDER.filter((step) => progress[step]).length;
  if (completedCount === COMPETENCIES_SETUP_STEP_ORDER.length) return null;

  const nextStep = COMPETENCIES_SETUP_STEP_ORDER.find((step) => !progress[step]);

  return (
    <Card
      role="region"
      aria-labelledby={titleId}
      data-testid={COMPETENCIES_HANDLES.GETTING_STARTED}
      className="flex flex-col gap-5 p-6"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h2 id={titleId} className="h6 text-neutral-950">
            {t("competencies.gettingStarted.title")}
          </h2>
          <p className="body-sm max-w-2xl text-neutral-800">
            {t("competencies.gettingStarted.description")}
          </p>
        </div>
        <div className="flex w-full flex-col gap-1.5 sm:w-48">
          <span className="details-md text-neutral-800">
            {t("competencies.gettingStarted.progress", {
              completed: completedCount,
              total: COMPETENCIES_SETUP_STEP_ORDER.length,
            })}
          </span>
          <Progress
            value={(completedCount / COMPETENCIES_SETUP_STEP_ORDER.length) * 100}
            aria-label={t("competencies.gettingStarted.title")}
            className="h-1.5 bg-neutral-100"
            indicatorClassName="bg-primary-700"
          />
        </div>
      </div>
      <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {COMPETENCIES_SETUP_STEP_ORDER.map((step, index) => {
          const done = progress[step];
          const isNext = step === nextStep;
          return (
            <li
              key={step}
              data-testid={COMPETENCIES_HANDLES.SETUP_STEP(step)}
              className={cn(
                "flex flex-col gap-3 rounded-lg border p-4",
                done && "border-neutral-200 bg-neutral-50",
                isNext && "border-primary-300 bg-primary-50",
                !done && !isNext && "border-neutral-200 bg-white",
              )}
            >
              <div className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    done && "bg-success-500 text-white",
                    isNext && "bg-primary-700 text-white",
                    !done && !isNext && "bg-neutral-100 text-neutral-800",
                  )}
                >
                  {done ? <Check className="size-4" /> : index + 1}
                </span>
                <h3 className="body-sm-md text-neutral-950">
                  {t(`competencies.gettingStarted.steps.${step}.title`)}
                </h3>
              </div>
              <p className="details flex-1 text-neutral-800">
                {t(`competencies.gettingStarted.steps.${step}.description`)}
              </p>
              {done ? (
                <span className="details-md text-success-700">
                  {t("competencies.gettingStarted.done")}
                </span>
              ) : (
                <Button
                  size="sm"
                  variant={isNext ? "primary" : "outline"}
                  className="self-start"
                  disabled={!isNext}
                  onClick={() => onStepStart(step)}
                >
                  {t(`competencies.gettingStarted.steps.${step}.action`)}
                </Button>
              )}
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
