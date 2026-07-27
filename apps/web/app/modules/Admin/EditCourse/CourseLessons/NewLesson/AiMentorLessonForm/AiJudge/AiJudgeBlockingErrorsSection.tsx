import { AlertTriangle, ChevronDown, Plus, Trash2 } from "lucide-react";
import { useFormContext } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { AutosizeTextarea } from "~/components/ui/autosize-textarea";
import { Button } from "~/components/ui/button";
import { FormControl, FormField, FormItem, FormMessage } from "~/components/ui/form";
import { Tooltip, TooltipArrow, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";

import type { AiJudgeConfigurationDraft } from "./aiJudgeConfiguration.types";
import type { RefObject } from "react";
import type { FieldArrayWithId } from "react-hook-form";

type AiJudgeBlockingErrorsSectionProps = {
  blockingErrors: FieldArrayWithId<AiJudgeConfigurationDraft, "blockingErrors", "formId">[];
  detailsRef: RefObject<HTMLDetailsElement>;
  canEditStructure: boolean;
  onAddBlockingError: () => void;
  onRemoveBlockingError: (index: number) => void;
};

export const AiJudgeBlockingErrorsSection = ({
  blockingErrors,
  detailsRef,
  canEditStructure,
  onAddBlockingError,
  onRemoveBlockingError,
}: AiJudgeBlockingErrorsSectionProps) => {
  const { t } = useTranslation();
  const form = useFormContext<AiJudgeConfigurationDraft>();

  return (
    <details
      ref={detailsRef}
      data-testid="curriculum-ai-mentor-judge-blocking-errors-section"
      className={cn("group mt-5 rounded-lg border bg-white", {
        "border-error-500": Boolean(form.formState.errors.blockingErrors),
        "border-neutral-200": !form.formState.errors.blockingErrors,
      })}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 [&::-webkit-details-marker]:hidden">
        <div className="flex items-center gap-3">
          <AlertTriangle className="size-4 text-warning-700" />
          <div>
            <p className="text-sm font-semibold text-neutral-900">
              {t("adminCourseView.curriculum.lesson.aiJudge.blockingErrors")}
            </p>
            <p className="text-xs text-neutral-500">
              {t("adminCourseView.curriculum.lesson.aiJudge.itemsCount", {
                count: blockingErrors.length,
              })}
            </p>
          </div>
        </div>
        <ChevronDown className="size-4 text-neutral-500 transition-transform group-open:rotate-180" />
      </summary>

      <div className="border-t border-neutral-100 px-4 py-4">
        {blockingErrors.length > 0 && (
          <div className="mb-3 space-y-3">
            {blockingErrors.map((blockingError, blockingErrorIndex) => (
              <div key={blockingError.formId} className="flex items-start gap-2">
                <FormField
                  control={form.control}
                  name={`blockingErrors.${blockingErrorIndex}.description`}
                  render={({ field, fieldState }) => (
                    <FormItem className="flex-1">
                      <FormControl>
                        <AutosizeTextarea
                          {...field}
                          data-testid={`curriculum-ai-mentor-judge-blocking-error-${blockingErrorIndex}-input`}
                          maxRows={5}
                          className={cn({ "border-error-500": fieldState.invalid })}
                          aria-label={t(
                            "adminCourseView.curriculum.lesson.aiJudge.blockingErrorNumber",
                            { number: blockingErrorIndex + 1 },
                          )}
                          placeholder={t(
                            "adminCourseView.curriculum.lesson.aiJudge.blockingErrorPlaceholder",
                          )}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      className={cn("inline-flex", { "cursor-not-allowed": !canEditStructure })}
                    >
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={!canEditStructure}
                        onClick={() => onRemoveBlockingError(blockingErrorIndex)}
                        aria-label={t(
                          "adminCourseView.curriculum.lesson.aiJudge.removeBlockingError",
                        )}
                        className="text-neutral-500 hover:text-error-700"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs rounded bg-black px-2 py-1 text-sm text-white shadow-md">
                    {t(
                      canEditStructure
                        ? "adminCourseView.curriculum.lesson.aiJudge.removeBlockingError"
                        : "adminCourseView.curriculum.lesson.aiJudge.structureLockedTooltip",
                    )}
                    <TooltipArrow className="fill-black" />
                  </TooltipContent>
                </Tooltip>
              </div>
            ))}
          </div>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={cn("inline-flex", { "cursor-not-allowed": !canEditStructure })}>
              <Button
                type="button"
                variant="outline"
                size="sm"
                data-testid="curriculum-ai-mentor-judge-add-blocking-error-button"
                disabled={!canEditStructure}
                onClick={onAddBlockingError}
              >
                <Plus className="mr-2 size-4" />
                {t("adminCourseView.curriculum.lesson.aiJudge.addBlockingError")}
              </Button>
            </span>
          </TooltipTrigger>
          {!canEditStructure && (
            <TooltipContent className="max-w-xs rounded bg-black px-2 py-1 text-sm text-white shadow-md">
              {t("adminCourseView.curriculum.lesson.aiJudge.structureLockedTooltip")}
              <TooltipArrow className="fill-black" />
            </TooltipContent>
          )}
        </Tooltip>
      </div>
    </details>
  );
};
