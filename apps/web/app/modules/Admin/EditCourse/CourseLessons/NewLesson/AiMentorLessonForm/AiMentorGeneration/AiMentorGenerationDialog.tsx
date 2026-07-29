import {
  AI_MENTOR_CONFIGURATION_GENERATION_STATUS,
  AI_MENTOR_TYPE,
} from "@repo/shared";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { BaseEditor } from "~/components/RichText/Editor";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Label } from "~/components/ui/label";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";
import { cn } from "~/lib/utils";
import { stripHtmlTags } from "~/utils/stripHtmlTags";

import { AI_MENTOR_GENERATION_MODE } from "./aiMentorGeneration.types";

import type {
  AiMentorGenerationMode,
  AiMentorGenerationRequest,
  AiMentorGenerationViewState,
} from "./aiMentorGeneration.types";
import type { AiMentorConfigurationDraft } from "../AiMentorConfiguration/aiMentorConfiguration.types";
import type { AiMentorType } from "@repo/shared";

type AiMentorGenerationDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: AiMentorGenerationMode;
  selectedType: AiMentorType;
  onSelectedTypeChange: (type: AiMentorType) => void;
  currentConfiguration?: AiMentorConfigurationDraft;
  state?: AiMentorGenerationViewState;
  onGenerate: (request: AiMentorGenerationRequest) => Promise<void> | void;
  onCancel?: () => Promise<void> | void;
  onRevise?: () => Promise<void> | void;
  onReview?: (state: AiMentorGenerationViewState) => void;
};

const isActive = (state?: AiMentorGenerationViewState) =>
  state?.status === AI_MENTOR_CONFIGURATION_GENERATION_STATUS.DRAFTING ||
  state?.status === AI_MENTOR_CONFIGURATION_GENERATION_STATUS.EVALUATING ||
  state?.status === AI_MENTOR_CONFIGURATION_GENERATION_STATUS.REVISING;

const isAiMentorGenerationType = (value: string): value is AiMentorType =>
  value === AI_MENTOR_TYPE.TEACHER || value === AI_MENTOR_TYPE.ROLEPLAY;

export const AiMentorGenerationDialog = ({
  open,
  onOpenChange,
  mode,
  selectedType,
  onSelectedTypeChange,
  currentConfiguration,
  state,
  onGenerate,
  onCancel,
  onRevise,
  onReview,
}: AiMentorGenerationDialogProps) => {
  const { t } = useTranslation();
  const [brief, setBrief] = useState("");
  const active = isActive(state);
  const isCreate = mode === AI_MENTOR_GENERATION_MODE.CREATE;

  const submit = () => {
    const normalizedBrief = stripHtmlTags(brief).trim();
    if (!normalizedBrief) return;
    if (mode === AI_MENTOR_GENERATION_MODE.CREATE) {
      void onGenerate({ mode, brief: normalizedBrief, configurationType: selectedType });
      return;
    }
    if (currentConfiguration)
      void onGenerate({ mode, instruction: normalizedBrief, currentConfiguration });
  };

  const renderBrief = () => (
    <div className="space-y-5">
      {isCreate && (
        <div>
          <Label>{t("adminCourseView.curriculum.lesson.aiMentorGeneration.modeLabel")}</Label>
          <RadioGroup
            data-testid="curriculum-ai-mentor-generation-mode"
            value={selectedType}
            onValueChange={(type) => {
              if (isAiMentorGenerationType(type)) onSelectedTypeChange(type);
            }}
            className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2"
          >
            {[AI_MENTOR_TYPE.TEACHER, AI_MENTOR_TYPE.ROLEPLAY].map((type) => (
              <label
                key={type}
                htmlFor={`ai-mentor-generation-${type}`}
                className={cn("flex cursor-pointer items-start gap-3 rounded-lg border p-3", {
                  "border-primary-600 bg-primary-50": selectedType === type,
                  "border-neutral-200": selectedType !== type,
                })}
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">
                    {t(`adminCourseView.curriculum.lesson.aiMentorConfiguration.mode.${type}.label`)}
                  </span>
                  <span className="mt-1 block text-xs text-neutral-600">
                    {t(`adminCourseView.curriculum.lesson.aiMentorConfiguration.mode.${type}.description`)}
                  </span>
                </span>
                <RadioGroupItem id={`ai-mentor-generation-${type}`} value={type} />
              </label>
            ))}
          </RadioGroup>
        </div>
      )}
      {!isCreate && (
        <p className="rounded-md bg-neutral-50 p-3 text-sm text-neutral-600">
          {t("adminCourseView.curriculum.lesson.aiMentorGeneration.improveTypeLocked", {
            type: t(`adminCourseView.curriculum.lesson.aiMentorConfiguration.mode.${selectedType}.label`),
          })}
        </p>
      )}
      <div>
        <Label>{t(`adminCourseView.curriculum.lesson.aiMentorGeneration.${mode}.fieldLabel`)}</Label>
        <p className="mt-1 text-sm text-neutral-600">
          {t(`adminCourseView.curriculum.lesson.aiMentorGeneration.${mode}.fieldDescription`)}
        </p>
        <BaseEditor
          content={brief}
          onChange={setBrief}
          ariaLabel={t(`adminCourseView.curriculum.lesson.aiMentorGeneration.${mode}.fieldLabel`)}
          parentClassName="mt-3 flex h-44 flex-col"
          contentClassName="min-h-0 flex-1 overflow-y-auto"
          editorClassName="!min-h-0"
          placeholder={t(`adminCourseView.curriculum.lesson.aiMentorGeneration.${mode}.placeholder`)}
        />
      </div>
    </div>
  );

  const renderProgress = () => (
    <div className="flex min-h-48 flex-col items-center justify-center text-center">
      <p className="font-semibold">{t("adminCourseView.curriculum.lesson.aiMentorGeneration.progressTitle")}</p>
      <p className="mt-2 text-sm text-neutral-600">
        {t("adminCourseView.curriculum.lesson.aiMentorGeneration.progressDescription")}
      </p>
    </div>
  );

  const renderTerminal = () => {
    if (!state) return renderBrief();
    const requiresRevision =
      state.status === AI_MENTOR_CONFIGURATION_GENERATION_STATUS.AWAITING_REVISION;
    const failed =
      state.status === AI_MENTOR_CONFIGURATION_GENERATION_STATUS.FAILED ||
      state.status === AI_MENTOR_CONFIGURATION_GENERATION_STATUS.CANCELLED;
    const titleKey = (() => {
      if (failed) return "adminCourseView.curriculum.lesson.aiMentorGeneration.failedTitle";
      if (requiresRevision) return "adminCourseView.curriculum.lesson.aiMentorGeneration.revisionTitle";
      return "adminCourseView.curriculum.lesson.aiMentorGeneration.readyTitle";
    })();
    return (
      <div className="space-y-4">
        <p className="font-semibold">{t(titleKey)}</p>
        {state.quality && <p className="text-sm text-neutral-600">{state.quality.summary}</p>}
        {state.changes.length > 0 && (
          <ul className="divide-y rounded-md border">
            {state.changes.map((change) => (
              <li key={change.field} className="p-3 text-sm">
                <span className="font-medium">{change.field}</span>
                <span className="block text-neutral-600">{change.after}</span>
              </li>
            ))}
          </ul>
        )}
        {state.error && <p className="text-sm text-error-700">{state.error}</p>}
      </div>
    );
  };

  const showProgress = active;
  const isAwaitingRevision =
    state?.status === AI_MENTOR_CONFIGURATION_GENERATION_STATUS.AWAITING_REVISION;
  const canReview = Boolean(
    state &&
      (state.status === AI_MENTOR_CONFIGURATION_GENERATION_STATUS.COMPLETED ||
        state.status === AI_MENTOR_CONFIGURATION_GENERATION_STATUS.REQUIRES_REVIEW),
  );

  const renderFooter = () => {
    if (active)
      return (
        <Button type="button" variant="outline" onClick={() => void onCancel?.()}>
          {t("adminCourseView.curriculum.lesson.aiMentorGeneration.cancel")}
        </Button>
      );

    if (isAwaitingRevision)
      return (
        <Button type="button" onClick={() => void onRevise?.()}>
          {t("adminCourseView.curriculum.lesson.aiMentorGeneration.revise")}
        </Button>
      );

    if (canReview && state)
      return (
        <Button type="button" onClick={() => onReview?.(state)}>
          {t("adminCourseView.curriculum.lesson.aiMentorGeneration.review")}
        </Button>
      );

    if (state)
      return (
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          {t("common.button.close")}
        </Button>
      );

    return (
      <>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          {t("common.button.cancel")}
        </Button>
        <Button type="button" onClick={submit}>
          {t(`adminCourseView.curriculum.lesson.aiMentorGeneration.${mode}.submit`)}
        </Button>
      </>
    );
  };

  return (
    <Dialog open={open} onOpenChange={active ? () => undefined : onOpenChange}>
      <DialogContent
        variant="mobileDrawer"
        data-testid="curriculum-ai-mentor-generation-dialog"
        className="!flex h-[85dvh] !flex-col sm:h-auto sm:w-[min(92vw,48rem)] sm:!max-w-none"
        noCloseButton={active}
      >
        <DialogHeader className="shrink-0 border-b border-neutral-200 px-5 py-4 pr-14 sm:px-6">
          <DialogTitle>
            {t(`adminCourseView.curriculum.lesson.aiMentorGeneration.${mode}.title`)}
          </DialogTitle>
          <DialogDescription>
            {t(`adminCourseView.curriculum.lesson.aiMentorGeneration.${mode}.description`)}
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          {showProgress ? renderProgress() : renderTerminal()}
        </div>
        <DialogFooter className="shrink-0 border-t border-neutral-200 px-5 py-4 sm:px-6">
          {renderFooter()}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
