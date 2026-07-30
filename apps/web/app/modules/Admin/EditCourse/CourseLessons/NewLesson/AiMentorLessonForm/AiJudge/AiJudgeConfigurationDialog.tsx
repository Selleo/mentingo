import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef, useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { match } from "ts-pattern";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Form } from "~/components/ui/form";

import { AiJudgeBlockingErrorsSection } from "./AiJudgeBlockingErrorsSection";
import {
  createEmptyAiJudgeConfiguration,
  createEmptyCriterion,
} from "./aiJudgeConfiguration.defaults";
import { aiJudgeConfigurationSchema } from "./aiJudgeConfiguration.schema";
import { AiJudgeConfigurationDialogFooter } from "./AiJudgeConfigurationDialogFooter";
import { AiJudgeCriteriaSection, getCriterionAccordionValue } from "./AiJudgeCriteriaSection";
import { AiJudgeScoringSection } from "./AiJudgeScoringSection";
import { AiJudgeTaskGoalField } from "./AiJudgeTaskGoalField";
import { AiJudgeValidationResultDialog } from "./AiJudgeValidationResultDialog";
import { useAiJudgeConfigurationValidation } from "./useAiJudgeConfigurationValidation";

import type {
  AiJudgeConfigurationDraft,
  AiJudgeValidationResult,
} from "./aiJudgeConfiguration.types";
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
  onValidateConfiguration?: (
    value: AiJudgeConfigurationDraft,
    signal?: AbortSignal,
  ) => Promise<AiJudgeValidationResult>;
  onImproveWithAi?: (
    value: AiJudgeConfigurationDraft,
    validation?: AiJudgeValidationResult,
  ) => void;
  isValidating?: boolean;
};

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
  onValidateConfiguration,
  onImproveWithAi,
  isValidating = false,
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
  const {
    result: validationResult,
    isChecking: isCheckingQuality,
    validateConfiguration,
    cancel: cancelQualityCheck,
    clearResult: clearValidationResult,
  } = useAiJudgeConfigurationValidation(onValidateConfiguration);
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
    clearValidationResult();
    form.reset(value ?? createEmptyAiJudgeConfiguration());
  }, [clearValidationResult, form, open, value]);

  useEffect(() => {
    if (!open) return;
    const subscription = form.watch(clearValidationResult);
    return () => subscription.unsubscribe();
  }, [clearValidationResult, form, open]);

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

  const handleValidate = form.handleSubmit(validateConfiguration, handleInvalidConfiguration);

  const handleImprove = () => {
    if (!onImproveWithAi) return;
    clearValidationResult();
    onImproveWithAi(form.getValues(), validationResult);
  };

  const addCriterion = () => {
    const accordionValue = getCriterionAccordionValue(criteria.fields.length);
    criteria.append(createEmptyCriterion());
    setOpenCriterionIds((current) => [...new Set([...current, accordionValue])]);
  };

  const removeCriterion = (criterionIndex: number) => {
    criteria.remove(criterionIndex);
    setOpenCriterionIds((current) =>
      current.flatMap((accordionValue) => {
        const openIndex = Number(accordionValue.replace("criterion-", ""));
        if (openIndex === criterionIndex) return [];
        if (openIndex > criterionIndex) return [getCriterionAccordionValue(openIndex - 1)];
        return [accordionValue];
      }),
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          variant="mobileDrawer"
          data-testid="curriculum-ai-mentor-judge-dialog"
          className="!flex h-[85dvh] !flex-col sm:h-auto sm:w-[min(96vw,58rem)] sm:!max-w-none"
        >
          <DialogHeader className="shrink-0 border-b border-neutral-200 px-5 py-4 pr-14 sm:px-6 sm:py-5">
            <DialogTitle className="text-xl">
              {t("adminCourseView.curriculum.lesson.aiJudge.dialogTitle")}
            </DialogTitle>
            <DialogDescription className="mt-1">
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
              <div className="min-h-0 flex-1 overscroll-contain overflow-y-auto px-5 py-5 [-webkit-overflow-scrolling:touch] sm:px-6">
                <AiJudgeTaskGoalField />
                <AiJudgeCriteriaSection
                  criteria={criteria.fields}
                  openCriterionIds={openCriterionIds}
                  canEditStructure={canEditStructure}
                  onOpenCriterionIdsChange={setOpenCriterionIds}
                  onAddCriterion={addCriterion}
                  onRemoveCriterion={removeCriterion}
                />
                <AiJudgeScoringSection
                  totalScore={totalScore}
                  requiredScore={requiredScore}
                  canEditStructure={canEditStructure}
                />
                <AiJudgeBlockingErrorsSection
                  blockingErrors={blockingErrors.fields}
                  detailsRef={blockingErrorsRef}
                  canEditStructure={canEditStructure}
                  onAddBlockingError={() => blockingErrors.append({ description: "" })}
                  onRemoveBlockingError={blockingErrors.remove}
                />
              </div>

              <AiJudgeConfigurationDialogFooter
                canEditStructure={canEditStructure}
                canImprove={Boolean(onImproveWithAi)}
                canValidate={Boolean(onValidateConfiguration)}
                isAiBusy={isValidating || isCheckingQuality}
                isSaving={isSaving}
                submitLabelKey={submitLabelKey}
                onCancel={() => onOpenChange(false)}
                onImprove={handleImprove}
                onValidate={() => void handleValidate()}
              />
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AiJudgeValidationResultDialog
        validation={validationResult}
        isLoading={isCheckingQuality || isValidating}
        onCancel={cancelQualityCheck}
        onOpenChange={(resultOpen) => {
          if (!resultOpen) clearValidationResult();
        }}
        onImprove={onImproveWithAi ? handleImprove : undefined}
      />
    </>
  );
};
