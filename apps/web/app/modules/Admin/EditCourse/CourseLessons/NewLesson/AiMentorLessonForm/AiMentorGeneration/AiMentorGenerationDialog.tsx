import { AI_MENTOR_CONFIGURATION_GENERATION_STATUS, AI_MENTOR_TYPE } from "@repo/shared";
import { AlertCircle, CircleAlert, Drama, GraduationCap } from "lucide-react";
import { useEffect, useState } from "react";
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
import { AiMentorGenerationProgressView } from "./AiMentorGenerationProgressView";
import {
  AiMentorGenerationQualityReviewFooter,
  AiMentorGenerationQualityReviewView,
} from "./AiMentorGenerationQualityReview";
import {
  AiMentorGenerationReviewFooter,
  AiMentorGenerationReviewView,
} from "./AiMentorGenerationReview";
import { AiMentorGenerationStageTracker } from "./AiMentorGenerationStageTracker";

import type {
  AiMentorGenerationMode,
  AiMentorGenerationRequest,
  AiMentorGenerationViewState,
} from "./aiMentorGeneration.types";
import type { AiMentorConfigurationDraft } from "../AiMentorConfiguration/aiMentorConfiguration.types";
import type { AiMentorType } from "@repo/shared";
import type { LucideIcon } from "lucide-react";

const AI_MENTOR_GENERATION_TYPE_ICONS: Record<AiMentorType, LucideIcon> = {
  [AI_MENTOR_TYPE.ROLEPLAY]: Drama,
  [AI_MENTOR_TYPE.TEACHER]: GraduationCap,
};

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
  const [isReviewingCurrentDraft, setIsReviewingCurrentDraft] = useState(false);
  const active = isActive(state);
  const isCreate = mode === AI_MENTOR_GENERATION_MODE.CREATE;

  useEffect(() => {
    if (!open || state?.status !== AI_MENTOR_CONFIGURATION_GENERATION_STATUS.AWAITING_REVISION)
      setIsReviewingCurrentDraft(false);
  }, [open, state?.status]);

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
            {[AI_MENTOR_TYPE.ROLEPLAY, AI_MENTOR_TYPE.TEACHER].map((type) => {
              const TypeIcon = AI_MENTOR_GENERATION_TYPE_ICONS[type];

              return (
                <label
                  key={type}
                  htmlFor={`ai-mentor-generation-${type}`}
                  className={cn("flex cursor-pointer items-start gap-3 rounded-lg border p-3", {
                    "border-primary-600 bg-primary-50": selectedType === type,
                    "border-neutral-200": selectedType !== type,
                  })}
                >
                  <span
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-700",
                      {
                        "bg-primary-100 text-primary-700": selectedType === type,
                      },
                    )}
                  >
                    <TypeIcon className="size-5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">
                      {t(
                        `adminCourseView.curriculum.lesson.aiMentorConfiguration.mode.${type}.label`,
                      )}
                    </span>
                    <span className="mt-1 block text-xs text-neutral-600">
                      {t(
                        `adminCourseView.curriculum.lesson.aiMentorConfiguration.mode.${type}.description`,
                      )}
                    </span>
                  </span>
                  <RadioGroupItem id={`ai-mentor-generation-${type}`} value={type} />
                </label>
              );
            })}
          </RadioGroup>
        </div>
      )}
      <div>
        <Label>
          {t(`adminCourseView.curriculum.lesson.aiMentorGeneration.${mode}.fieldLabel`)}
        </Label>
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
          placeholder={t(
            `adminCourseView.curriculum.lesson.aiMentorGeneration.${mode}.placeholder`,
          )}
        />
      </div>
    </div>
  );

  const content = (() => {
    if (!state) return renderBrief();

    if (isReviewingCurrentDraft)
      return <AiMentorGenerationReviewView state={state} mode={mode} isCurrentDraftReview />;

    switch (state.status) {
      case AI_MENTOR_CONFIGURATION_GENERATION_STATUS.DRAFTING:
      case AI_MENTOR_CONFIGURATION_GENERATION_STATUS.EVALUATING:
      case AI_MENTOR_CONFIGURATION_GENERATION_STATUS.REVISING:
        return <AiMentorGenerationProgressView state={state} mode={mode} onCancel={onCancel} />;
      case AI_MENTOR_CONFIGURATION_GENERATION_STATUS.AWAITING_REVISION:
        return <AiMentorGenerationQualityReviewView state={state} />;
      case AI_MENTOR_CONFIGURATION_GENERATION_STATUS.COMPLETED:
      case AI_MENTOR_CONFIGURATION_GENERATION_STATUS.REQUIRES_REVIEW:
        return <AiMentorGenerationReviewView state={state} mode={mode} />;
      case AI_MENTOR_CONFIGURATION_GENERATION_STATUS.FAILED:
      case AI_MENTOR_CONFIGURATION_GENERATION_STATUS.CANCELLED:
        return (
          <div className="flex items-start gap-3 rounded-lg border border-neutral-200 p-4">
            {state.status === AI_MENTOR_CONFIGURATION_GENERATION_STATUS.FAILED ? (
              <AlertCircle className="mt-0.5 size-5 shrink-0 text-error-700" aria-hidden />
            ) : (
              <CircleAlert className="mt-0.5 size-5 shrink-0 text-neutral-600" aria-hidden />
            )}
            <div>
              <p className="font-semibold text-neutral-950">
                {t(`adminCourseView.curriculum.lesson.aiMentorGeneration.status.${state.status}`)}
              </p>
              <p className="mt-1 text-sm text-neutral-600">
                {state.error ??
                  t(
                    `adminCourseView.curriculum.lesson.aiMentorGeneration.statusDescription.${state.status}`,
                  )}
              </p>
            </div>
          </div>
        );
    }
  })();
  const qualityReviewFooter = state?.status ===
    AI_MENTOR_CONFIGURATION_GENERATION_STATUS.AWAITING_REVISION &&
    !isReviewingCurrentDraft && (
      <AiMentorGenerationQualityReviewFooter
        state={state}
        onRevise={() => onRevise?.()}
        onContinue={() => setIsReviewingCurrentDraft(true)}
      />
    );
  const shouldShowReviewFooter =
    isReviewingCurrentDraft ||
    state?.status === AI_MENTOR_CONFIGURATION_GENERATION_STATUS.COMPLETED ||
    state?.status === AI_MENTOR_CONFIGURATION_GENERATION_STATUS.REQUIRES_REVIEW;
  const reviewFooter = shouldShowReviewFooter && state?.draft && (
    <AiMentorGenerationReviewFooter
      draft={state.draft}
      onReviewConfiguration={() => onReview?.(state)}
    />
  );
  const terminalFooter = state &&
    (state.status === AI_MENTOR_CONFIGURATION_GENERATION_STATUS.FAILED ||
      state.status === AI_MENTOR_CONFIGURATION_GENERATION_STATUS.CANCELLED) && (
      <DialogFooter className="shrink-0 border-t border-neutral-200 bg-white px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 sm:px-6 sm:py-4">
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          {t("common.button.close")}
        </Button>
      </DialogFooter>
    );
  const briefFooter = !state && (
    <DialogFooter className="shrink-0 border-t border-neutral-200 bg-white px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 sm:px-6 sm:py-4">
      <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
        {t("common.button.cancel")}
      </Button>
      <Button type="button" onClick={submit}>
        {t(`adminCourseView.curriculum.lesson.aiMentorGeneration.${mode}.submit`)}
      </Button>
    </DialogFooter>
  );

  return (
    <Dialog open={open} onOpenChange={active ? () => undefined : onOpenChange}>
      <DialogContent
        variant="mobileDrawer"
        data-testid="curriculum-ai-mentor-generation-dialog"
        className={cn("!flex h-[88dvh] !flex-col sm:h-auto sm:max-h-[92dvh] sm:!max-w-none", {
          "sm:w-[min(92vw,48rem)]": !state,
          "sm:w-[min(92vw,52rem)]": Boolean(state),
        })}
        noCloseButton={active}
      >
        <DialogHeader className="shrink-0 border-b border-neutral-200 px-5 py-4 pr-14 sm:px-6 sm:py-5">
          <DialogTitle className="text-xl">
            {t(`adminCourseView.curriculum.lesson.aiMentorGeneration.${mode}.title`)}
          </DialogTitle>
          <DialogDescription>
            {t(`adminCourseView.curriculum.lesson.aiMentorGeneration.${mode}.description`)}
          </DialogDescription>
        </DialogHeader>

        {state && (
          <div className="shrink-0 border-b border-neutral-100 px-5 py-4 sm:px-6">
            <AiMentorGenerationStageTracker
              status={
                isReviewingCurrentDraft
                  ? AI_MENTOR_CONFIGURATION_GENERATION_STATUS.COMPLETED
                  : state.status
              }
            />
          </div>
        )}

        <div className="min-h-0 flex-1 overscroll-contain overflow-y-auto px-5 py-5 [-webkit-overflow-scrolling:touch] sm:px-6">
          {content}
        </div>
        {briefFooter}
        {qualityReviewFooter}
        {reviewFooter}
        {terminalFooter}
      </DialogContent>
    </Dialog>
  );
};
