import { AI_MENTOR_TYPE } from "@repo/shared";
import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Tooltip, TooltipArrow, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";

import { AiMentorConfigurationDialog } from "./AiMentorConfigurationDialog";

import type { AiMentorConfigurationDraft } from "./aiMentorConfiguration.types";
import type { AiMentorValidationResult } from "../AiMentorGeneration/aiMentorGeneration.types";
import type { SupportedLanguages } from "@repo/shared";

type AiMentorConfigurationCardProps = {
  value?: AiMentorConfigurationDraft;
  onSaveBaseConfiguration: (value: AiMentorConfigurationDraft) => Promise<void> | void;
  onSaveTranslation: (value: AiMentorConfigurationDraft) => Promise<void> | void;
  language: SupportedLanguages;
  baseLanguage: SupportedLanguages;
  isPersisted: boolean;
  isLoading?: boolean;
  isSaving?: boolean;
  needsConfiguration?: boolean;
  error?: string;
  onCreateWithAi?: () => void;
  onImproveWithAi?: (
    value: AiMentorConfigurationDraft,
    validation?: AiMentorValidationResult,
  ) => void;
  onValidateConfiguration?: (
    value: AiMentorConfigurationDraft,
    signal?: AbortSignal,
  ) => Promise<AiMentorValidationResult>;
  isValidating?: boolean;
  editorOpen?: boolean;
  onEditorOpenChange?: (open: boolean) => void;
};

export const AiMentorConfigurationCard = ({
  value,
  onSaveBaseConfiguration,
  onSaveTranslation,
  language,
  baseLanguage,
  isPersisted,
  isLoading = false,
  isSaving = false,
  needsConfiguration = false,
  error,
  onCreateWithAi,
  onImproveWithAi,
  onValidateConfiguration,
  isValidating = false,
  editorOpen,
  onEditorOpenChange,
}: AiMentorConfigurationCardProps) => {
  const { t } = useTranslation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const isDialogOpen = editorOpen ?? dialogOpen;
  const setIsDialogOpen = onEditorOpenChange ?? setDialogOpen;
  const isConfigured = Boolean(value);
  const canOpenDialog =
    !isLoading &&
    (language === baseLanguage || (isPersisted && isConfigured && !needsConfiguration));
  const requiresBaseConfiguration =
    language !== baseLanguage && (!isConfigured || needsConfiguration);
  const hasError = Boolean(error) || needsConfiguration;

  const summary = (() => {
    if (!value) return null;

    if (value.type === AI_MENTOR_TYPE.TEACHER) {
      const expertise =
        value.expertise.trim() ||
        value.taskGoal.trim() ||
        t("adminCourseView.curriculum.lesson.aiMentorConfiguration.mode.teacher.label");
      const teachingStyle = t(
        `adminCourseView.curriculum.lesson.aiMentorConfiguration.teachingStyle.${value.teachingStyle}.label`,
      );
      return t("adminCourseView.curriculum.lesson.aiMentorConfiguration.summary", {
        type: t("adminCourseView.curriculum.lesson.aiMentorConfiguration.mode.teacher.label"),
        detail: expertise,
        behavior: teachingStyle,
      });
    }

    const aiRole =
      value.aiRole.trim() ||
      value.scenario.trim() ||
      t("adminCourseView.curriculum.lesson.aiMentorConfiguration.mode.roleplay.label");
    const difficulty = t(
      `adminCourseView.curriculum.lesson.aiMentorConfiguration.difficulty.${value.difficulty}.label`,
    );
    return t("adminCourseView.curriculum.lesson.aiMentorConfiguration.summary", {
      type: t("adminCourseView.curriculum.lesson.aiMentorConfiguration.mode.roleplay.label"),
      detail: aiRole,
      behavior: difficulty,
    });
  })();
  const description = (() => {
    if (needsConfiguration)
      return t("adminCourseView.curriculum.lesson.aiMentorConfiguration.incompleteDescription");
    if (summary) return summary;
    if (canOpenDialog)
      return t("adminCourseView.curriculum.lesson.aiMentorConfiguration.emptyDescription");
    return t("adminCourseView.curriculum.lesson.aiMentorConfiguration.baseLanguageRequired");
  })();
  const actionLabel = isConfigured
    ? t("adminCourseView.curriculum.lesson.aiMentorConfiguration.editConfiguration")
    : t("adminCourseView.curriculum.lesson.aiMentorConfiguration.configureManually");

  return (
    <>
      <Card
        className={cn("mb-6 overflow-hidden shadow-none", {
          "border-error-500": hasError,
          "border-neutral-200": !hasError,
        })}
      >
        <CardContent className="p-0">
          <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h3 className="font-semibold text-neutral-950">
                {t("adminCourseView.curriculum.lesson.aiMentorConfiguration.cardTitle")}
              </h3>
              <p className="mt-1 text-sm text-neutral-600">{description}</p>
              {error && <p className="mt-1 text-sm text-error-700">{error}</p>}
            </div>

            <div className="flex max-w-full shrink-0 flex-nowrap items-center gap-2 overflow-x-auto">
              {!isConfigured && onCreateWithAi && language === baseLanguage && (
                <Button
                  type="button"
                  size="sm"
                  className="shrink-0 whitespace-nowrap"
                  onClick={onCreateWithAi}
                >
                  {t("adminCourseView.curriculum.lesson.aiMentorGeneration.createWithAi")}
                </Button>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    className={cn("inline-flex shrink-0", {
                      "cursor-not-allowed": !canOpenDialog,
                    })}
                  >
                    <Button
                      type="button"
                      variant={isConfigured ? "outline" : "link"}
                      size="sm"
                      data-testid="curriculum-ai-mentor-configuration-button"
                      disabled={!canOpenDialog}
                      onClick={() => setIsDialogOpen(true)}
                      className={cn("h-9 shrink-0 gap-1.5 whitespace-nowrap", {
                        "px-1.5": !isConfigured,
                      })}
                    >
                      {actionLabel}
                      {isConfigured && <ChevronRight className="size-3.5" />}
                    </Button>
                  </span>
                </TooltipTrigger>
                {requiresBaseConfiguration && (
                  <TooltipContent
                    side="top"
                    align="center"
                    className="max-w-xs rounded bg-black px-2 py-1 text-sm text-white shadow-md"
                  >
                    {t(
                      "adminCourseView.curriculum.lesson.aiMentorConfiguration.structureLockedTooltip",
                    )}
                    <TooltipArrow className="fill-black" />
                  </TooltipContent>
                )}
              </Tooltip>
            </div>
          </div>
        </CardContent>
      </Card>

      <AiMentorConfigurationDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        value={value}
        onSaveBaseConfiguration={onSaveBaseConfiguration}
        onSaveTranslation={onSaveTranslation}
        language={language}
        baseLanguage={baseLanguage}
        isPersisted={isPersisted}
        isSaving={isSaving}
        onImproveWithAi={onImproveWithAi}
        onValidateConfiguration={onValidateConfiguration}
        isValidating={isValidating}
      />
    </>
  );
};
