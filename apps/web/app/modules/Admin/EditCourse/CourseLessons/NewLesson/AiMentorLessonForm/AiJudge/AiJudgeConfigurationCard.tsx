import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Tooltip, TooltipArrow, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";

import { AI_JUDGE_GENERATION_MODE } from "./aiJudgeConfiguration.types";
import { AiJudgeConfigurationDialog } from "./AiJudgeConfigurationDialog";

import type {
  AiJudgeConfigurationDraft,
  AiJudgeGenerationMode,
  AiJudgeValidationResult,
} from "./aiJudgeConfiguration.types";
import type { SupportedLanguages } from "@repo/shared";

type AiJudgeConfigurationCardBaseProps = {
  value?: AiJudgeConfigurationDraft;
  onSaveBaseConfiguration: (value: AiJudgeConfigurationDraft) => Promise<void> | void;
  onSaveTranslation: (value: AiJudgeConfigurationDraft) => Promise<void> | void;
  language: SupportedLanguages;
  baseLanguage: SupportedLanguages;
  isPersisted: boolean;
  isLoading?: boolean;
  isSaving?: boolean;
  onConfigureWithAi?: (mode: AiJudgeGenerationMode) => void;
  onValidateConfiguration?: (value: AiJudgeConfigurationDraft) => Promise<AiJudgeValidationResult>;
  onImproveWithAi?: (
    value: AiJudgeConfigurationDraft,
    validation?: AiJudgeValidationResult,
  ) => void;
  isValidating?: boolean;
  error?: string;
};

type AiJudgeConfigurationCardProps = AiJudgeConfigurationCardBaseProps &
  (
    | {
        editorOpen: boolean;
        onEditorOpenChange: (open: boolean) => void;
      }
    | {
        editorOpen?: never;
        onEditorOpenChange?: never;
      }
  );

export const AiJudgeConfigurationCard = ({
  value,
  onSaveBaseConfiguration,
  onSaveTranslation,
  language,
  baseLanguage,
  isPersisted,
  isLoading = false,
  isSaving = false,
  onConfigureWithAi,
  editorOpen,
  onEditorOpenChange,
  onValidateConfiguration,
  onImproveWithAi,
  isValidating,
  error,
}: AiJudgeConfigurationCardProps) => {
  const { t } = useTranslation();
  const [internalEditorOpen, setInternalEditorOpen] = useState(false);
  const isDialogOpen = editorOpen ?? internalEditorOpen;
  const setIsDialogOpen = onEditorOpenChange ?? setInternalEditorOpen;
  const isConfigured = Boolean(value);
  const canOpenEditor = !isLoading && (language === baseLanguage || (isPersisted && isConfigured));
  const requiresBaseConfiguration = language !== baseLanguage && !isConfigured;
  const totalScore = value?.criteria.reduce((sum, criterion) => sum + criterion.maxScore, 0) ?? 0;
  const emptyDescriptionKey = canOpenEditor
    ? "adminCourseView.curriculum.lesson.aiJudge.emptyDescription"
    : "adminCourseView.curriculum.lesson.aiJudge.baseLanguageRequired";
  const editorButtonLabelKey = isConfigured
    ? "adminCourseView.curriculum.lesson.aiJudge.editAssessment"
    : "adminCourseView.curriculum.lesson.aiJudge.configureManually";
  const isAiActionDisabled = language !== baseLanguage || isLoading;

  return (
    <>
      <Card
        className={cn("mb-6 overflow-hidden shadow-none", {
          "border-error-500": Boolean(error),
          "border-neutral-200": !error,
        })}
      >
        <CardContent className="p-0">
          <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h3 className="font-semibold text-neutral-950">
                {t("adminCourseView.curriculum.lesson.aiJudge.cardTitle")}
              </h3>
              {value ? (
                <p className="mt-1 text-sm text-neutral-600">
                  {t("adminCourseView.curriculum.lesson.aiJudge.summary", {
                    criteria: value.criteria.length,
                    score: totalScore,
                    threshold: value.passingThresholdPercent,
                    blockingErrors: value.blockingErrors.length,
                  })}
                </p>
              ) : (
                <p className="mt-1 text-sm text-neutral-600">{t(emptyDescriptionKey)}</p>
              )}
              {error && <p className="mt-1 text-sm text-error-700">{error}</p>}
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
              {!isConfigured && onConfigureWithAi && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      className={cn("inline-flex", {
                        "cursor-not-allowed": isAiActionDisabled,
                      })}
                    >
                      <Button
                        type="button"
                        size="sm"
                        disabled={isAiActionDisabled}
                        onClick={() => onConfigureWithAi(AI_JUDGE_GENERATION_MODE.CREATE)}
                        className="h-9"
                      >
                        {t("adminCourseView.curriculum.lesson.aiJudge.createWithAi")}
                      </Button>
                    </span>
                  </TooltipTrigger>
                  {language !== baseLanguage && (
                    <TooltipContent
                      side="top"
                      align="center"
                      className="max-w-xs rounded bg-black px-2 py-1 text-sm text-white shadow-md"
                    >
                      {t("adminCourseView.curriculum.lesson.aiJudge.structureLockedTooltip")}
                      <TooltipArrow className="fill-black" />
                    </TooltipContent>
                  )}
                </Tooltip>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    className={cn("inline-flex", {
                      "order-first": isConfigured,
                      "cursor-not-allowed": !canOpenEditor,
                    })}
                  >
                    <Button
                      type="button"
                      variant={isConfigured ? "outline" : "link"}
                      size="sm"
                      data-testid="curriculum-ai-mentor-judge-configure-button"
                      disabled={!canOpenEditor}
                      onClick={() => setIsDialogOpen(true)}
                      className={cn("h-9 gap-1.5", { "px-1.5": !isConfigured })}
                    >
                      {t(editorButtonLabelKey)}
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
                    {t("adminCourseView.curriculum.lesson.aiJudge.structureLockedTooltip")}
                    <TooltipArrow className="fill-black" />
                  </TooltipContent>
                )}
              </Tooltip>
            </div>
          </div>
        </CardContent>
      </Card>

      <AiJudgeConfigurationDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        value={value}
        onSaveBaseConfiguration={onSaveBaseConfiguration}
        onSaveTranslation={onSaveTranslation}
        language={language}
        baseLanguage={baseLanguage}
        isPersisted={isPersisted}
        isSaving={isSaving}
        onValidateConfiguration={onValidateConfiguration}
        onImproveWithAi={onImproveWithAi}
        isValidating={isValidating}
      />
    </>
  );
};
