import { Plus } from "lucide-react";
import { useFormContext } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { Accordion } from "~/components/ui/accordion";
import { Button } from "~/components/ui/button";
import { Tooltip, TooltipArrow, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";

import { AiJudgeCriterionEditor } from "./AiJudgeCriterionEditor";

import type { AiJudgeConfigurationDraft } from "./aiJudgeConfiguration.types";
import type { FieldArrayWithId } from "react-hook-form";

type AiJudgeCriteriaSectionProps = {
  criteria: FieldArrayWithId<AiJudgeConfigurationDraft, "criteria", "formId">[];
  openCriterionIds: string[];
  canEditStructure: boolean;
  onOpenCriterionIdsChange: (values: string[]) => void;
  onAddCriterion: () => void;
  onRemoveCriterion: (index: number) => void;
};

export const getCriterionAccordionValue = (criterionIndex: number) => `criterion-${criterionIndex}`;

export const AiJudgeCriteriaSection = ({
  criteria,
  openCriterionIds,
  canEditStructure,
  onOpenCriterionIdsChange,
  onAddCriterion,
  onRemoveCriterion,
}: AiJudgeCriteriaSectionProps) => {
  const { t } = useTranslation();
  const form = useFormContext<AiJudgeConfigurationDraft>();
  const structureLockedTooltip = t(
    "adminCourseView.curriculum.lesson.aiJudge.structureLockedTooltip",
  );

  return (
    <section className="mt-7">
      <h3 className="font-semibold text-neutral-950">
        {t("adminCourseView.curriculum.lesson.aiJudge.criteria")}
      </h3>

      {criteria.length === 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={cn("mt-4 block w-full", { "cursor-not-allowed": !canEditStructure })}>
              <button
                type="button"
                data-testid="curriculum-ai-mentor-judge-add-criterion-button"
                disabled={!canEditStructure}
                onClick={onAddCriterion}
                className="flex w-full flex-col items-center justify-center rounded-lg border border-dashed border-primary-300 bg-primary-50/40 px-5 py-8 text-center transition-colors hover:border-primary-500 hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:border-neutral-200 disabled:bg-neutral-50 disabled:opacity-60"
              >
                <span className="flex size-10 items-center justify-center rounded-full bg-white text-primary-700 shadow-sm">
                  <Plus className="size-5" />
                </span>
                <span className="mt-3 font-semibold text-primary-800">
                  {t("adminCourseView.curriculum.lesson.aiJudge.addFirstCriterion")}
                </span>
              </button>
            </span>
          </TooltipTrigger>
          {!canEditStructure && (
            <TooltipContent className="max-w-xs rounded bg-black px-2 py-1 text-sm text-white shadow-md">
              {structureLockedTooltip}
              <TooltipArrow className="fill-black" />
            </TooltipContent>
          )}
        </Tooltip>
      )}

      {criteria.length > 0 && (
        <>
          <Accordion
            type="multiple"
            value={openCriterionIds}
            onValueChange={onOpenCriterionIdsChange}
            className="mt-4 space-y-3"
          >
            {criteria.map((criterion, criterionIndex) => (
              <AiJudgeCriterionEditor
                key={criterion.formId}
                accordionValue={getCriterionAccordionValue(criterionIndex)}
                control={form.control}
                criterionIndex={criterionIndex}
                canEditStructure={canEditStructure}
                hasError={Boolean(form.formState.errors.criteria?.[criterionIndex])}
                onRemove={() => onRemoveCriterion(criterionIndex)}
              />
            ))}
          </Accordion>
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className={cn("mt-3 block w-full", {
                  "cursor-not-allowed": !canEditStructure,
                })}
              >
                <Button
                  type="button"
                  variant="outline"
                  data-testid="curriculum-ai-mentor-judge-add-criterion-button"
                  disabled={!canEditStructure}
                  onClick={onAddCriterion}
                  className="w-full border-dashed"
                >
                  <Plus className="mr-2 size-4" />
                  {t("adminCourseView.curriculum.lesson.aiJudge.addCriterion")}
                </Button>
              </span>
            </TooltipTrigger>
            {!canEditStructure && (
              <TooltipContent className="max-w-xs rounded bg-black px-2 py-1 text-sm text-white shadow-md">
                {structureLockedTooltip}
                <TooltipArrow className="fill-black" />
              </TooltipContent>
            )}
          </Tooltip>
        </>
      )}
    </section>
  );
};
