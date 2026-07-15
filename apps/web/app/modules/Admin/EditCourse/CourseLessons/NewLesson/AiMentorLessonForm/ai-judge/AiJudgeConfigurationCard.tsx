import { ChevronRight, CircleCheck, Scale, Sparkles } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Tooltip, TooltipArrow, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";

import { AiJudgeConfigurationDialog } from "./AiJudgeConfigurationDialog";

import type { AiJudgeConfigurationDraft } from "./aiJudgeConfiguration.types";
import type { SupportedLanguages } from "@repo/shared";

type AiJudgeConfigurationCardProps = {
  value?: AiJudgeConfigurationDraft;
  onSaveBaseConfiguration: (value: AiJudgeConfigurationDraft) => Promise<void> | void;
  onSaveTranslation: (value: AiJudgeConfigurationDraft) => Promise<void> | void;
  language: SupportedLanguages;
  baseLanguage: SupportedLanguages;
  isPersisted: boolean;
  isLoading?: boolean;
  isSaving?: boolean;
  onConfigureWithAi?: () => void;
  error?: string;
};

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
  error,
}: AiJudgeConfigurationCardProps) => {
  const { t } = useTranslation();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const isConfigured = Boolean(value);
  const canOpenEditor = !isLoading && (language === baseLanguage || (isPersisted && isConfigured));
  const requiresBaseConfiguration = language !== baseLanguage && !isConfigured;
  const totalScore = value?.criteria.reduce((sum, criterion) => sum + criterion.maxScore, 0) ?? 0;
  const emptyDescriptionKey = canOpenEditor
    ? "adminCourseView.curriculum.lesson.aiJudge.emptyDescription"
    : "adminCourseView.curriculum.lesson.aiJudge.baseLanguageRequired";
  const editorButtonLabelKey = value
    ? "adminCourseView.curriculum.lesson.aiJudge.editAssessment"
    : "adminCourseView.curriculum.lesson.aiJudge.configureManually";

  return (
    <>
      <Card
        className={cn("mb-6 overflow-hidden shadow-none", {
          "border-error-500": Boolean(error),
          "border-neutral-200": !error,
        })}
      >
        <CardContent className="p-0">
          <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-700">
                <Scale className="size-5" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-neutral-950">
                    {t("adminCourseView.curriculum.lesson.aiJudge.cardTitle")}
                  </h3>
                  {isConfigured && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-success-50 px-2 py-0.5 text-xs font-medium text-success-800">
                      <CircleCheck className="size-3.5" />
                      {t("adminCourseView.curriculum.lesson.aiJudge.configured")}
                    </span>
                  )}
                </div>
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
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
              {!value && onConfigureWithAi && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      className={cn("inline-flex", {
                        "cursor-not-allowed": language !== baseLanguage || isLoading,
                      })}
                    >
                      <Button
                        type="button"
                        disabled={language !== baseLanguage || isLoading}
                        onClick={onConfigureWithAi}
                      >
                        <Sparkles className="mr-2 size-4" />
                        {t("adminCourseView.curriculum.lesson.aiJudge.configureWithAi")}
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
                      "cursor-not-allowed": !canOpenEditor,
                    })}
                  >
                    <Button
                      type="button"
                      variant="outline"
                      data-testid="curriculum-ai-mentor-judge-configure-button"
                      disabled={!canOpenEditor}
                      onClick={() => setIsDialogOpen(true)}
                    >
                      {t(editorButtonLabelKey)}
                      <ChevronRight className="ml-2 size-4" />
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
      />
    </>
  );
};
