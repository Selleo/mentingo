import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, ChevronDown, ListChecks, Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { match } from "ts-pattern";

import { Accordion } from "~/components/ui/accordion";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Tooltip, TooltipArrow, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";

import {
  createEmptyAiJudgeConfiguration,
  createEmptyCriterion,
} from "./aiJudgeConfiguration.defaults";
import { aiJudgeConfigurationSchema } from "./aiJudgeConfiguration.schema";
import { AiJudgeCriterionEditor } from "./AiJudgeCriterionEditor";

import type { AiJudgeConfigurationDraft } from "./aiJudgeConfiguration.types";
import type { SupportedLanguages } from "@repo/shared";
import type { FieldErrors } from "react-hook-form";

type AiJudgeConfigurationDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value?: AiJudgeConfigurationDraft;
  onSaveBaseConfiguration: (value: AiJudgeConfigurationDraft) => Promise<void> | void;
  onSaveTranslation: (value: AiJudgeConfigurationDraft) => Promise<void> | void;
  language: SupportedLanguages;
  baseLanguage: SupportedLanguages;
  isPersisted: boolean;
  isSaving?: boolean;
};

const getCriterionAccordionValue = (criterionIndex: number) => `criterion-${criterionIndex}`;

export const AiJudgeConfigurationDialog = ({
  open,
  onOpenChange,
  value,
  onSaveBaseConfiguration,
  onSaveTranslation,
  language,
  baseLanguage,
  isPersisted,
  isSaving = false,
}: AiJudgeConfigurationDialogProps) => {
  const { t } = useTranslation();
  const [openCriterionIds, setOpenCriterionIds] = useState<string[]>([]);
  const blockingErrorsRef = useRef<HTMLDetailsElement>(null);
  const canEditStructure = language === baseLanguage;
  const form = useForm<AiJudgeConfigurationDraft>({
    resolver: zodResolver(aiJudgeConfigurationSchema(t)),
    defaultValues: value ?? createEmptyAiJudgeConfiguration(),
  });
  const criteria = useFieldArray({
    control: form.control,
    name: "criteria",
    keyName: "formId",
  });
  const blockingErrors = useFieldArray({
    control: form.control,
    name: "blockingErrors",
    keyName: "formId",
  });
  const watchedCriteria = useWatch({ control: form.control, name: "criteria" });
  const passingThresholdPercent = useWatch({
    control: form.control,
    name: "passingThresholdPercent",
  });
  const totalScore = watchedCriteria.reduce(
    (sum, criterion) => sum + (Number.isFinite(criterion.maxScore) ? criterion.maxScore : 0),
    0,
  );
  const requiredScore = Number.isFinite(passingThresholdPercent)
    ? Math.ceil((totalScore * passingThresholdPercent) / 100)
    : 0;
  const shouldShowEmptyAddCriterion = criteria.fields.length === 0;
  const removeBlockingErrorTooltipKey = canEditStructure
    ? "adminCourseView.curriculum.lesson.aiJudge.removeBlockingError"
    : "adminCourseView.curriculum.lesson.aiJudge.structureLockedTooltip";
  const submitLabelKey = match({ canEditStructure, isPersisted })
    .with(
      { canEditStructure: true, isPersisted: true },
      () => "adminCourseView.curriculum.lesson.aiJudge.saveConfiguration" as const,
    )
    .with(
      { canEditStructure: true, isPersisted: false },
      () => "adminCourseView.curriculum.lesson.aiJudge.applyConfiguration" as const,
    )
    .otherwise(() => "adminCourseView.curriculum.lesson.aiJudge.saveTranslation" as const);

  useEffect(() => {
    if (!open) return;
    setOpenCriterionIds([]);
    form.reset(value ?? createEmptyAiJudgeConfiguration());
  }, [form, open, value]);

  const handleInvalidConfiguration = (errors: FieldErrors<AiJudgeConfigurationDraft>) => {
    const invalidCriterionIds: string[] = [];
    if (Array.isArray(errors.criteria))
      errors.criteria.forEach((criterionError, index) => {
        if (criterionError) invalidCriterionIds.push(getCriterionAccordionValue(index));
      });
    setOpenCriterionIds((current) => [...new Set([...current, ...invalidCriterionIds])]);

    if (
      Array.isArray(errors.blockingErrors) &&
      errors.blockingErrors.some(Boolean) &&
      blockingErrorsRef.current
    )
      blockingErrorsRef.current.open = true;
  };

  const handleSave = form.handleSubmit(async (configuration) => {
    if (canEditStructure) await onSaveBaseConfiguration(configuration);
    else await onSaveTranslation(configuration);

    onOpenChange(false);
  }, handleInvalidConfiguration);

  const addCriterion = () => {
    const accordionValue = getCriterionAccordionValue(criteria.fields.length);
    criteria.append(createEmptyCriterion());
    setOpenCriterionIds((current) => [...new Set([...current, accordionValue])]);
  };

  const removeCriterion = (criterionIndex: number) => {
    criteria.remove(criterionIndex);
    setOpenCriterionIds((current) => {
      return current.flatMap((accordionValue) => {
        const openIndex = Number(accordionValue.replace("criterion-", ""));
        if (openIndex === criterionIndex) return [];
        if (openIndex > criterionIndex) return [getCriterionAccordionValue(openIndex - 1)];
        return [accordionValue];
      });
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] w-[min(96vw,58rem)] max-w-none flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-neutral-200 px-6 py-5 pr-14">
          <DialogTitle className="text-xl">
            {t("adminCourseView.curriculum.lesson.aiJudge.dialogTitle")}
          </DialogTitle>
          <DialogDescription>
            {t("adminCourseView.curriculum.lesson.aiJudge.dialogDescription")}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={(event) => {
              event.stopPropagation();
              void handleSave(event);
            }}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              <FormField
                control={form.control}
                name="taskGoal"
                render={({ field, fieldState }) => (
                  <FormItem>
                    <FormLabel className="text-base text-neutral-900">
                      {t("adminCourseView.curriculum.lesson.aiJudge.taskGoal")}
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        data-testid="curriculum-ai-mentor-judge-task-goal-input"
                        className={cn({ "border-error-500": fieldState.invalid })}
                        rows={3}
                        placeholder={t(
                          "adminCourseView.curriculum.lesson.aiJudge.taskGoalPlaceholder",
                        )}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <section className="mt-7">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="font-semibold text-neutral-950">
                      {t("adminCourseView.curriculum.lesson.aiJudge.criteria")}
                    </h3>
                  </div>
                </div>

                {shouldShowEmptyAddCriterion && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span
                        className={cn("mt-4 block w-full", {
                          "cursor-not-allowed": !canEditStructure,
                        })}
                      >
                        <button
                          type="button"
                          disabled={!canEditStructure}
                          onClick={addCriterion}
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
                        {t("adminCourseView.curriculum.lesson.aiJudge.structureLockedTooltip")}
                        <TooltipArrow className="fill-black" />
                      </TooltipContent>
                    )}
                  </Tooltip>
                )}
                {criteria.fields.length > 0 && (
                  <Accordion
                    type="multiple"
                    value={openCriterionIds}
                    onValueChange={setOpenCriterionIds}
                    className="mt-4 space-y-3"
                  >
                    {criteria.fields.map((criterion, criterionIndex) => (
                      <AiJudgeCriterionEditor
                        key={criterion.formId}
                        accordionValue={getCriterionAccordionValue(criterionIndex)}
                        control={form.control}
                        criterionIndex={criterionIndex}
                        canEditStructure={canEditStructure}
                        hasError={Boolean(form.formState.errors.criteria?.[criterionIndex])}
                        onRemove={() => removeCriterion(criterionIndex)}
                      />
                    ))}
                  </Accordion>
                )}

                {criteria.fields.length > 0 && (
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
                          disabled={!canEditStructure}
                          onClick={addCriterion}
                          className="w-full border-dashed"
                        >
                          <Plus className="mr-2 size-4" />
                          {t("adminCourseView.curriculum.lesson.aiJudge.addCriterion")}
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
                )}
              </section>

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
                      <FormItem className="flex items-center gap-3 space-y-0">
                        <FormLabel className="whitespace-nowrap text-sm text-neutral-900">
                          {t("adminCourseView.curriculum.lesson.aiJudge.passingThreshold")}
                        </FormLabel>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="relative inline-flex w-24">
                              <FormControl>
                                <Input
                                  {...field}
                                  type="number"
                                  min={1}
                                  max={100}
                                  disabled={!canEditStructure}
                                  className={cn("pr-8", {
                                    "border-error-500": fieldState.invalid,
                                  })}
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
                              {t(
                                "adminCourseView.curriculum.lesson.aiJudge.structureLockedTooltip",
                              )}
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

              <details
                ref={blockingErrorsRef}
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
                          count: blockingErrors.fields.length,
                        })}
                      </p>
                    </div>
                  </div>
                  <ChevronDown className="size-4 text-neutral-500 transition-transform group-open:rotate-180" />
                </summary>

                <div className="border-t border-neutral-100 px-4 py-4">
                  {blockingErrors.fields.length > 0 && (
                    <div className="mb-3 space-y-3">
                      {blockingErrors.fields.map((blockingError, blockingErrorIndex) => (
                        <div key={blockingError.formId} className="flex items-start gap-2">
                          <FormField
                            control={form.control}
                            name={`blockingErrors.${blockingErrorIndex}.description`}
                            render={({ field, fieldState }) => (
                              <FormItem className="flex-1">
                                <FormControl>
                                  <Input
                                    {...field}
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
                                className={cn("inline-flex", {
                                  "cursor-not-allowed": !canEditStructure,
                                })}
                              >
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  disabled={!canEditStructure}
                                  onClick={() => blockingErrors.remove(blockingErrorIndex)}
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
                              {t(removeBlockingErrorTooltipKey)}
                              <TooltipArrow className="fill-black" />
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      ))}
                    </div>
                  )}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span
                        className={cn("inline-flex", {
                          "cursor-not-allowed": !canEditStructure,
                        })}
                      >
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={!canEditStructure}
                          onClick={() => blockingErrors.append({ description: "" })}
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
            </div>

            <DialogFooter className="border-t border-neutral-200 bg-white px-6 py-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t("common.button.cancel")}
              </Button>
              <Button
                type="submit"
                data-testid="curriculum-ai-mentor-judge-apply-button"
                disabled={isSaving}
              >
                {t(submitLabelKey)}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
