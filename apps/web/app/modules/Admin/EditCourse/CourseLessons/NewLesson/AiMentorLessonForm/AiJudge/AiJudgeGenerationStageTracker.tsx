import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "~/lib/utils";

import { AI_JUDGE_GENERATION_STATUS } from "./aiJudgeConfiguration.types";

import type { AiJudgeGenerationStatus } from "./aiJudgeConfiguration.types";

const getActiveStep = (status: AiJudgeGenerationStatus) => {
  if (status === AI_JUDGE_GENERATION_STATUS.COMPLETED) return 3;
  if (
    status === AI_JUDGE_GENERATION_STATUS.EVALUATING ||
    status === AI_JUDGE_GENERATION_STATUS.AWAITING_REVISION ||
    status === AI_JUDGE_GENERATION_STATUS.REQUIRES_REVIEW
  )
    return 2;

  return 1;
};

export const AiJudgeGenerationStageTracker = ({ status }: { status: AiJudgeGenerationStatus }) => {
  const { t } = useTranslation();
  const activeStep = getActiveStep(status);
  const steps = [
    t("adminCourseView.curriculum.lesson.aiJudge.generation.stages.draft"),
    t("adminCourseView.curriculum.lesson.aiJudge.generation.stages.qualityCheck"),
    t("adminCourseView.curriculum.lesson.aiJudge.generation.stages.ready"),
  ];

  return (
    <ol
      className="grid grid-cols-3 gap-2 border-y border-neutral-200 py-4"
      aria-label={t("adminCourseView.curriculum.lesson.aiJudge.generation.progressLabel")}
    >
      {steps.map((label, index) => {
        const step = index + 1;
        const isComplete = activeStep > step || status === AI_JUDGE_GENERATION_STATUS.COMPLETED;
        const isActive = activeStep === step && !isComplete;

        return (
          <li key={label} className="flex min-w-0 items-center justify-center gap-2 text-center">
            <span
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                {
                  "border-success-600 bg-success-600 text-white": isComplete,
                  "border-primary-700 bg-primary-700 text-white": isActive,
                  "border-neutral-300 bg-white text-neutral-600": !isComplete && !isActive,
                },
              )}
            >
              {isComplete ? <Check className="size-4" aria-hidden /> : step}
            </span>
            <span
              className={cn("truncate text-xs font-medium sm:text-sm", {
                "text-neutral-950": isComplete || isActive,
                "text-neutral-500": !isComplete && !isActive,
              })}
            >
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
};
