import { zodResolver } from "@hookform/resolvers/zod";
import { AI_MENTOR_TYPE } from "@repo/shared";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { match } from "ts-pattern";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Form } from "~/components/ui/form";

import { AiMentorQualityCheckDialog } from "../AiMentorGeneration/AiMentorQualityCheckDialog";
import { useAiMentorConfigurationValidation } from "../AiMentorGeneration/useAiMentorConfigurationValidation";

import {
  createEmptyAiMentorConfiguration,
  hasAiMentorModeSpecificContent,
  switchAiMentorConfigurationType,
} from "./aiMentorConfiguration.defaults";
import { aiMentorConfigurationSchema } from "./aiMentorConfiguration.schema";
import { AiMentorConfigurationDialogFooter } from "./AiMentorConfigurationDialogFooter";
import { AiMentorConfigurationFields } from "./AiMentorConfigurationFields";

import type { AiMentorConfigurationDraft } from "./aiMentorConfiguration.types";
import type { AiMentorValidationResult } from "../AiMentorGeneration/aiMentorGeneration.types";
import type { AiMentorType, SupportedLanguages } from "@repo/shared";

type AiMentorConfigurationDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value?: AiMentorConfigurationDraft;
  onSaveBaseConfiguration: (value: AiMentorConfigurationDraft) => Promise<void> | void;
  onSaveTranslation: (value: AiMentorConfigurationDraft) => Promise<void> | void;
  language: SupportedLanguages;
  baseLanguage: SupportedLanguages;
  isPersisted: boolean;
  isSaving?: boolean;
  onValidateConfiguration?: (
    value: AiMentorConfigurationDraft,
    signal?: AbortSignal,
  ) => Promise<AiMentorValidationResult>;
  onImproveWithAi?: (
    value: AiMentorConfigurationDraft,
    validation?: AiMentorValidationResult,
  ) => void;
  isValidating?: boolean;
};

export const AiMentorConfigurationDialog = ({
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
}: AiMentorConfigurationDialogProps) => {
  const { t } = useTranslation();
  const [pendingType, setPendingType] = useState<AiMentorType | null>(null);
  const canEditStructure = language === baseLanguage;
  const form = useForm<AiMentorConfigurationDraft>({
    resolver: zodResolver(aiMentorConfigurationSchema(t)),
    defaultValues: value ?? createEmptyAiMentorConfiguration(),
  });
  const {
    result: validationResult,
    isChecking: isCheckingQuality,
    validateConfiguration,
    cancel: cancelQualityCheck,
    clearResult: clearValidationResult,
  } = useAiMentorConfigurationValidation(onValidateConfiguration);
  const submitLabelKey = match({ canEditStructure, isPersisted })
    .with(
      { canEditStructure: true, isPersisted: true },
      () => "adminCourseView.curriculum.lesson.aiMentorConfiguration.saveConfiguration" as const,
    )
    .with(
      { canEditStructure: true, isPersisted: false },
      () => "adminCourseView.curriculum.lesson.aiMentorConfiguration.applyConfiguration" as const,
    )
    .otherwise(
      () => "adminCourseView.curriculum.lesson.aiMentorConfiguration.saveTranslation" as const,
    );

  useEffect(() => {
    if (!open) return;
    setPendingType(null);
    clearValidationResult();
    form.reset(value ?? createEmptyAiMentorConfiguration());
  }, [clearValidationResult, form, open, value]);

  useEffect(() => {
    if (!open) return;
    const subscription = form.watch(clearValidationResult);
    return () => subscription.unsubscribe();
  }, [clearValidationResult, form, open]);

  const applyTypeChange = (type: AiMentorType) => {
    const currentConfiguration = form.getValues();
    const nextConfiguration = switchAiMentorConfigurationType(currentConfiguration, type);

    if (currentConfiguration.type === AI_MENTOR_TYPE.TEACHER) {
      form.resetField("taskGoal", { defaultValue: "" });
      form.resetField("expertise", { defaultValue: "" });
      form.resetField("contentScope", { defaultValue: "" });
      form.resetField("feedbackGuidance", { defaultValue: "" });
    } else {
      form.resetField("scenario", { defaultValue: "" });
      form.resetField("aiRole", { defaultValue: "" });
      form.resetField("learnerRole", { defaultValue: "" });
      form.resetField("characterGoal", { defaultValue: "" });
      form.resetField("factsAndConstraints", { defaultValue: "" });
    }

    form.reset(nextConfiguration);
    setPendingType(null);
  };

  const handleTypeChange = (type: AiMentorType) => {
    const configuration = form.getValues();
    if (configuration.type === type) return;

    if (hasAiMentorModeSpecificContent(configuration)) {
      setPendingType(type);
      return;
    }

    applyTypeChange(type);
  };

  const handleSave = form.handleSubmit(async (configuration) => {
    if (canEditStructure) await onSaveBaseConfiguration(configuration);
    else await onSaveTranslation(configuration);
    onOpenChange(false);
  });
  const handleValidate = form.handleSubmit(validateConfiguration);
  const handleImprove = () => {
    if (!onImproveWithAi) return;
    clearValidationResult();
    onImproveWithAi(form.getValues(), validationResult);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          variant="mobileDrawer"
          data-testid="curriculum-ai-mentor-configuration-dialog"
          className="!flex h-[85dvh] !flex-col sm:h-auto sm:w-[min(96vw,52rem)] sm:!max-w-none"
        >
          <DialogHeader className="shrink-0 border-b border-neutral-200 px-5 py-4 pr-14 sm:px-6 sm:py-5">
            <DialogTitle className="text-xl">
              {t("adminCourseView.curriculum.lesson.aiMentorConfiguration.dialogTitle")}
            </DialogTitle>
            <DialogDescription className="mt-1">
              {t("adminCourseView.curriculum.lesson.aiMentorConfiguration.dialogDescription")}
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
                <AiMentorConfigurationFields
                  canEditStructure={canEditStructure}
                  onTypeChange={handleTypeChange}
                />
              </div>

              <AiMentorConfigurationDialogFooter
                canEditStructure={canEditStructure}
                canImprove={Boolean(onImproveWithAi) && Boolean(value)}
                canValidate={Boolean(onValidateConfiguration) && Boolean(value)}
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

      <AlertDialog
        open={Boolean(pendingType)}
        onOpenChange={(confirmationOpen) => {
          if (!confirmationOpen) setPendingType(null);
        }}
      >
        <AlertDialogContent
          overlayClassName="z-[60] bg-neutral-950 opacity-40"
          className="z-[70] !max-w-md"
        >
          <AlertDialogHeader className="text-left">
            <AlertDialogTitle>
              {t("adminCourseView.curriculum.lesson.aiMentorConfiguration.typeChange.title")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("adminCourseView.curriculum.lesson.aiMentorConfiguration.typeChange.description", {
                type:
                  pendingType === AI_MENTOR_TYPE.TEACHER
                    ? t(
                        "adminCourseView.curriculum.lesson.aiMentorConfiguration.mode.teacher.label",
                      )
                    : t(
                        "adminCourseView.curriculum.lesson.aiMentorConfiguration.mode.roleplay.label",
                      ),
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4">
            <AlertDialogCancel onClick={() => setPendingType(null)}>
              {t("common.button.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingType) applyTypeChange(pendingType);
              }}
            >
              {t("clientStatisticsView.button.continue")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AiMentorQualityCheckDialog
        isLoading={isCheckingQuality || isValidating}
        result={validationResult}
        onCancel={cancelQualityCheck}
        onOpenChange={(resultOpen) => {
          if (!resultOpen) clearValidationResult();
        }}
        onImprove={onImproveWithAi ? handleImprove : undefined}
      />
    </>
  );
};
