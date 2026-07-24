import { AI_JUDGE_MAX_CRITERION_SCORE } from "@repo/shared";
import { ChevronDown, Circle, CircleCheck, Trash2 } from "lucide-react";
import { useEffect } from "react";
import { useFieldArray, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "~/components/ui/accordion";
import { AutosizeTextarea } from "~/components/ui/autosize-textarea";
import { Button } from "~/components/ui/button";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { Tooltip, TooltipArrow, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";

import {
  isAiJudgeCriterionComplete,
  reconcileScoreGuidance,
} from "./aiJudgeConfiguration.defaults";

import type { AiJudgeConfigurationDraft } from "./aiJudgeConfiguration.types";
import type { Control } from "react-hook-form";

type AiJudgeCriterionEditorProps = {
  control: Control<AiJudgeConfigurationDraft>;
  criterionIndex: number;
  accordionValue: string;
  canEditStructure: boolean;
  hasError: boolean;
  onRemove: () => void;
};

export const AiJudgeCriterionEditor = ({
  control,
  criterionIndex,
  accordionValue,
  canEditStructure,
  hasError,
  onRemove,
}: AiJudgeCriterionEditorProps) => {
  const { t } = useTranslation();
  const guidance = useFieldArray({
    control,
    name: `criteria.${criterionIndex}.scoreGuidance`,
    keyName: "formId",
  });
  const maxScore = useWatch({
    control,
    name: `criteria.${criterionIndex}.maxScore`,
  });
  const guidanceValues = useWatch({
    control,
    name: `criteria.${criterionIndex}.scoreGuidance`,
  });
  const criterion = useWatch({
    control,
    name: `criteria.${criterionIndex}`,
  });
  const isComplete = isAiJudgeCriterionComplete(criterion);
  const criterionTitle =
    criterion.title.trim() || t("adminCourseView.curriculum.lesson.aiJudge.untitledCriterion");
  const removeCriterionTooltipKey = canEditStructure
    ? "adminCourseView.curriculum.lesson.aiJudge.removeCriterion"
    : "adminCourseView.curriculum.lesson.aiJudge.structureLockedTooltip";

  useEffect(() => {
    if (
      !canEditStructure ||
      !Number.isInteger(maxScore) ||
      maxScore < 1 ||
      maxScore > AI_JUDGE_MAX_CRITERION_SCORE
    )
      return;

    const hasExpectedScores =
      guidanceValues.length === maxScore + 1 &&
      guidanceValues.every((item, score) => item.score === score);

    if (hasExpectedScores) return;

    guidance.replace(reconcileScoreGuidance(maxScore, guidanceValues));
  }, [canEditStructure, guidance, guidanceValues, maxScore]);

  return (
    <AccordionItem
      value={accordionValue}
      data-testid={`curriculum-ai-mentor-judge-criterion-${criterionIndex}`}
      className={cn("overflow-hidden rounded-lg border bg-white", {
        "border-error-500": hasError,
        "border-neutral-200": !hasError,
      })}
    >
      <div className="relative hover:bg-neutral-50">
        <AccordionTrigger
          data-testid={`curriculum-ai-mentor-judge-criterion-${criterionIndex}-toggle`}
          className="group w-full min-w-0 gap-3 py-3 pl-4 pr-3 text-left"
        >
          <span className="flex min-w-0 flex-1 items-center gap-3 pr-16">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-50 text-sm font-semibold text-primary-700">
              {criterionIndex + 1}
            </span>
            <span className="min-w-0 truncate text-sm font-semibold text-neutral-950">
              {criterionTitle}
            </span>
            <span className="shrink-0 rounded-md bg-neutral-100 px-2 py-1 text-xs font-semibold text-neutral-700">
              {t("adminCourseView.curriculum.lesson.aiJudge.scoreBadge", {
                score: Number.isFinite(criterion.maxScore) ? criterion.maxScore : 0,
              })}
            </span>
            <span className="hidden shrink-0 items-center gap-1.5 text-xs text-neutral-500 sm:flex">
              {isComplete ? (
                <CircleCheck className="size-3.5 text-success-700" />
              ) : (
                <Circle className="size-3.5 text-neutral-400" />
              )}
              {isComplete
                ? t("adminCourseView.curriculum.lesson.aiJudge.complete")
                : t("adminCourseView.curriculum.lesson.aiJudge.needsDetails")}
            </span>
          </span>
          <ChevronDown className="ml-auto size-4 shrink-0 text-neutral-500 transition-transform group-data-[state=open]:rotate-180" />
        </AccordionTrigger>
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className={cn("absolute right-9 top-1/2 z-10 inline-flex -translate-y-1/2", {
                "cursor-not-allowed": !canEditStructure,
              })}
            >
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={!canEditStructure}
                onClick={(event) => {
                  event.stopPropagation();
                  onRemove();
                }}
                aria-label={t("adminCourseView.curriculum.lesson.aiJudge.removeCriterion")}
                className="size-9 text-neutral-500 hover:bg-error-50 hover:text-error-700 focus-visible:text-error-700"
              >
                <Trash2 className="size-4" />
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs rounded bg-black px-2 py-1 text-sm text-white shadow-md">
            {t(removeCriterionTooltipKey)}
            <TooltipArrow className="fill-black" />
          </TooltipContent>
        </Tooltip>
      </div>

      <AccordionContent className="border-t border-neutral-100 p-4">
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_8rem]">
          <FormField
            control={control}
            name={`criteria.${criterionIndex}.title`}
            render={({ field, fieldState }) => (
              <FormItem>
                <FormLabel className="text-neutral-900">
                  {t("adminCourseView.curriculum.lesson.aiJudge.criterionTitle")}
                </FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    data-testid={`curriculum-ai-mentor-judge-criterion-${criterionIndex}-title-input`}
                    className={cn({ "border-error-500": fieldState.invalid })}
                    placeholder={t(
                      "adminCourseView.curriculum.lesson.aiJudge.criterionTitlePlaceholder",
                    )}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name={`criteria.${criterionIndex}.maxScore`}
            render={({ field, fieldState }) => (
              <FormItem>
                <FormLabel className="whitespace-nowrap text-neutral-900">
                  {t("adminCourseView.curriculum.lesson.aiJudge.maxScore")}
                </FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    data-testid={`curriculum-ai-mentor-judge-criterion-${criterionIndex}-max-score-input`}
                    type="number"
                    min={1}
                    max={AI_JUDGE_MAX_CRITERION_SCORE}
                    disabled={!canEditStructure}
                    className={cn({ "border-error-500": fieldState.invalid })}
                    onChange={(event) => field.onChange(event.target.valueAsNumber)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={control}
          name={`criteria.${criterionIndex}.expectedBehavior`}
          render={({ field, fieldState }) => (
            <FormItem className="mt-4">
              <FormLabel className="text-neutral-900">
                {t("adminCourseView.curriculum.lesson.aiJudge.expectedBehavior")}
              </FormLabel>
              <FormControl>
                <AutosizeTextarea
                  {...field}
                  data-testid={`curriculum-ai-mentor-judge-criterion-${criterionIndex}-expected-behavior-input`}
                  className={cn({ "border-error-500": fieldState.invalid })}
                  placeholder={t(
                    "adminCourseView.curriculum.lesson.aiJudge.expectedBehaviorPlaceholder",
                  )}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Accordion type="single" collapsible className="mt-4 border-t border-neutral-100 pt-1">
          <AccordionItem value="scoring-guidance" className="border-0">
            <AccordionTrigger
              data-testid={`curriculum-ai-mentor-judge-criterion-${criterionIndex}-scoring-guidance-toggle`}
              className="group rounded-md px-2 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
            >
              <span>
                {t("adminCourseView.curriculum.lesson.aiJudge.advancedScoring")}
                {guidance.fields.length > 0 && (
                  <span className="ml-2 font-normal text-neutral-500">
                    {t("adminCourseView.curriculum.lesson.aiJudge.scoreLevelsCount", {
                      count: guidance.fields.length,
                    })}
                  </span>
                )}
              </span>
              <ChevronDown className="size-4 transition-transform group-data-[state=open]:rotate-180" />
            </AccordionTrigger>

            <AccordionContent className="px-2 pb-2 pt-2">
              <div className="divide-y divide-neutral-100 border-t border-neutral-100">
                {guidance.fields.map((guidanceField, guidanceIndex) => (
                  <div key={guidanceField.formId} className="py-3">
                    <div className="grid gap-3 sm:grid-cols-[5rem_minmax(0,1fr)] sm:items-start">
                      <span className="mt-6 inline-flex h-8 items-center justify-center rounded-md bg-neutral-100 px-2 text-sm font-semibold text-neutral-700">
                        {t("adminCourseView.curriculum.lesson.aiJudge.scoreBadge", {
                          score: guidanceField.score,
                        })}
                      </span>
                      <FormField
                        control={control}
                        name={`criteria.${criterionIndex}.scoreGuidance.${guidanceIndex}.description`}
                        render={({ field, fieldState }) => (
                          <FormItem>
                            <FormLabel className="text-neutral-900">
                              {t("adminCourseView.curriculum.lesson.aiJudge.scoreDescription")}
                            </FormLabel>
                            <FormControl>
                              <AutosizeTextarea
                                {...field}
                                data-testid={`curriculum-ai-mentor-judge-criterion-${criterionIndex}-score-${guidanceField.score}-description-input`}
                                maxRows={4}
                                className={cn({ "border-error-500": fieldState.invalid })}
                                placeholder={t(
                                  "adminCourseView.curriculum.lesson.aiJudge.scoreDescriptionPlaceholder",
                                )}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={control}
                      name={`criteria.${criterionIndex}.scoreGuidance.${guidanceIndex}.example`}
                      render={({ field, fieldState }) => (
                        <FormItem className="mt-3 sm:ml-[6rem]">
                          <FormLabel className="text-neutral-900">
                            {t("adminCourseView.curriculum.lesson.aiJudge.acceptedExample")}
                            <span className="ml-1 text-xs font-normal text-neutral-500">
                              ({t("adminCourseView.curriculum.lesson.other.optional")})
                            </span>
                          </FormLabel>
                          <FormControl>
                            <AutosizeTextarea
                              {...field}
                              data-testid={`curriculum-ai-mentor-judge-criterion-${criterionIndex}-score-${guidanceField.score}-example-input`}
                              maxRows={4}
                              value={field.value ?? ""}
                              className={cn({ "border-error-500": fieldState.invalid })}
                              placeholder={t(
                                "adminCourseView.curriculum.lesson.aiJudge.examplePlaceholder",
                              )}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </AccordionContent>
    </AccordionItem>
  );
};
