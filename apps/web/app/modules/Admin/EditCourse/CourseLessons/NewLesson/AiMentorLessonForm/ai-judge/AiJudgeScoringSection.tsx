import { ListChecks } from "lucide-react";
import { useFormContext } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { Tooltip, TooltipArrow, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";

import type { AiJudgeConfigurationDraft } from "./aiJudgeConfiguration.types";

type AiJudgeScoringSectionProps = {
  totalScore: number;
  requiredScore: number;
  canEditStructure: boolean;
};

export const AiJudgeScoringSection = ({
  totalScore,
  requiredScore,
  canEditStructure,
}: AiJudgeScoringSectionProps) => {
  const { t } = useTranslation();
  const form = useFormContext<AiJudgeConfigurationDraft>();

  return (
    <section className="mt-7 rounded-lg bg-neutral-50 px-4 py-3">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-lg bg-white text-neutral-700 shadow-sm">
            <ListChecks className="size-4" />
          </span>
          <div>
            <p className="text-sm font-semibold text-neutral-900">
              {t("adminCourseView.curriculum.lesson.aiJudge.scoringSummary")}
            </p>
            <p className="text-sm text-neutral-600">
              {t("adminCourseView.curriculum.lesson.aiJudge.pointsRequired", {
                required: requiredScore,
                total: totalScore,
              })}
            </p>
          </div>
        </div>
        <FormField
          control={form.control}
          name="passingThresholdPercent"
          render={({ field, fieldState }) => (
            <FormItem className="flex w-full flex-col items-stretch gap-2 space-y-0 sm:w-auto sm:flex-row sm:items-center sm:gap-3">
              <FormLabel className="whitespace-nowrap text-sm text-neutral-900">
                {t("adminCourseView.curriculum.lesson.aiJudge.passingThreshold")}
              </FormLabel>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="relative inline-flex w-full sm:w-24">
                    <FormControl>
                      <Input
                        {...field}
                        data-testid="curriculum-ai-mentor-judge-passing-threshold-input"
                        type="number"
                        min={0}
                        max={100}
                        disabled={!canEditStructure}
                        className={cn("pr-8", { "border-error-500": fieldState.invalid })}
                        onChange={(event) => field.onChange(event.target.valueAsNumber)}
                      />
                    </FormControl>
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-neutral-500">
                      %
                    </span>
                  </span>
                </TooltipTrigger>
                {!canEditStructure && (
                  <TooltipContent className="max-w-xs rounded bg-black px-2 py-1 text-sm text-white shadow-md">
                    {t("adminCourseView.curriculum.lesson.aiJudge.structureLockedTooltip")}
                    <TooltipArrow className="fill-black" />
                  </TooltipContent>
                )}
              </Tooltip>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </section>
  );
};
