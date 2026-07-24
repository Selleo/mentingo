import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { cn } from "~/lib/utils";

import { AI_JUDGE_GENERATION_MODE, AI_JUDGE_GENERATION_STATUS } from "./aiJudgeConfiguration.types";
import { AiJudgeGenerationBriefForm } from "./AiJudgeGenerationBriefForm";
import { AiJudgeGenerationProgressView } from "./AiJudgeGenerationProgressView";
import { AiJudgeGenerationQualityReviewFooter } from "./AiJudgeGenerationQualityReviewFooter";
import { AiJudgeGenerationQualityReviewView } from "./AiJudgeGenerationQualityReviewView";
import { AiJudgeGenerationReviewFooter } from "./AiJudgeGenerationReviewFooter";
import { AiJudgeGenerationReviewView } from "./AiJudgeGenerationReviewView";
import { AiJudgeGenerationStageTracker } from "./AiJudgeGenerationStageTracker";
import { AiJudgeGenerationTerminalView } from "./AiJudgeGenerationTerminalView";

import type {
  AiJudgeConfigurationDraft,
  AiJudgeGenerationMode,
  AiJudgeGenerationRequest,
  AiJudgeGenerationStatus,
  AiJudgeGenerationViewState,
} from "./aiJudgeConfiguration.types";

type AiJudgeGenerationDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: AiJudgeGenerationMode;
  state?: AiJudgeGenerationViewState;
  onGenerate: (request: AiJudgeGenerationRequest) => Promise<void> | void;
  onCancel?: () => Promise<void> | void;
  onStopAndInspect?: () => Promise<void> | void;
  onReviewAssessment: (draft: AiJudgeConfigurationDraft) => void;
  onRevise: () => Promise<void> | void;
  isRevising?: boolean;
};

const isGenerationActive = (status: AiJudgeGenerationStatus) =>
  status === AI_JUDGE_GENERATION_STATUS.DRAFTING ||
  status === AI_JUDGE_GENERATION_STATUS.EVALUATING ||
  status === AI_JUDGE_GENERATION_STATUS.REVISING;

export const AiJudgeGenerationDialog = ({
  open,
  onOpenChange,
  mode,
  state,
  onGenerate,
  onCancel,
  onStopAndInspect,
  onReviewAssessment,
  onRevise,
  isRevising = false,
}: AiJudgeGenerationDialogProps) => {
  const { t } = useTranslation();
  const [isReviewingCurrentDraft, setIsReviewingCurrentDraft] = useState(false);
  const active = state ? isGenerationActive(state.status) : false;

  useEffect(() => {
    if (!open || state?.status !== AI_JUDGE_GENERATION_STATUS.AWAITING_REVISION)
      setIsReviewingCurrentDraft(false);
  }, [open, state?.status]);

  const content = (() => {
    if (!state) return <AiJudgeGenerationBriefForm mode={mode} onGenerate={onGenerate} />;

    if (isReviewingCurrentDraft)
      return <AiJudgeGenerationReviewView state={state} mode={mode} isCurrentDraftReview />;

    switch (state.status) {
      case AI_JUDGE_GENERATION_STATUS.DRAFTING:
      case AI_JUDGE_GENERATION_STATUS.EVALUATING:
      case AI_JUDGE_GENERATION_STATUS.REVISING:
        return (
          <AiJudgeGenerationProgressView
            state={state}
            mode={mode}
            onCancel={onCancel}
            onStopAndInspect={onStopAndInspect}
          />
        );
      case AI_JUDGE_GENERATION_STATUS.AWAITING_REVISION:
        return <AiJudgeGenerationQualityReviewView state={state} mode={mode} />;
      case AI_JUDGE_GENERATION_STATUS.COMPLETED:
      case AI_JUDGE_GENERATION_STATUS.REQUIRES_REVIEW:
        return <AiJudgeGenerationReviewView state={state} mode={mode} />;
      case AI_JUDGE_GENERATION_STATUS.FAILED:
      case AI_JUDGE_GENERATION_STATUS.CANCELLED:
        return <AiJudgeGenerationTerminalView state={state} onOpenChange={onOpenChange} />;
    }
  })();
  const qualityReviewFooter = state?.status === AI_JUDGE_GENERATION_STATUS.AWAITING_REVISION &&
    !isReviewingCurrentDraft && (
      <AiJudgeGenerationQualityReviewFooter
        state={state}
        onRevise={onRevise}
        isRevising={isRevising}
        onContinue={() => setIsReviewingCurrentDraft(true)}
      />
    );
  const shouldShowReviewFooter =
    isReviewingCurrentDraft ||
    state?.status === AI_JUDGE_GENERATION_STATUS.COMPLETED ||
    state?.status === AI_JUDGE_GENERATION_STATUS.REQUIRES_REVIEW;
  const reviewFooter = shouldShowReviewFooter && state && (
    <AiJudgeGenerationReviewFooter state={state} onReviewAssessment={onReviewAssessment} />
  );

  return (
    <Dialog open={open} onOpenChange={active ? () => undefined : onOpenChange}>
      <DialogContent
        variant="mobileDrawer"
        {...(mode === AI_JUDGE_GENERATION_MODE.CREATE ? { "aria-describedby": undefined } : {})}
        className={cn("!flex h-[88dvh] !flex-col sm:h-auto sm:max-h-[92dvh] sm:!max-w-none", {
          "sm:w-[min(92vw,48rem)]": !state,
          "sm:w-[min(92vw,52rem)]": Boolean(state),
        })}
        noCloseButton={active}
      >
        <DialogHeader className="shrink-0 border-b border-neutral-200 px-5 py-4 pr-14 sm:px-6 sm:py-5">
          <DialogTitle className="text-xl">
            {t(`adminCourseView.curriculum.lesson.aiJudge.generation.${mode}.title`)}
          </DialogTitle>
          {mode !== AI_JUDGE_GENERATION_MODE.CREATE && (
            <DialogDescription className="text-neutral-600">
              {t(`adminCourseView.curriculum.lesson.aiJudge.generation.${mode}.description`)}
            </DialogDescription>
          )}
        </DialogHeader>

        {state && (
          <div className="shrink-0 border-b border-neutral-100 px-5 py-4 sm:px-6">
            <AiJudgeGenerationStageTracker
              status={isReviewingCurrentDraft ? AI_JUDGE_GENERATION_STATUS.COMPLETED : state.status}
            />
          </div>
        )}

        <div
          data-testid="ai-judge-generation-dialog-body"
          className="min-h-0 flex-1 overscroll-contain overflow-y-auto px-5 py-5 [-webkit-overflow-scrolling:touch] sm:px-6"
        >
          {content}
        </div>
        {qualityReviewFooter}
        {reviewFooter}
      </DialogContent>
    </Dialog>
  );
};
