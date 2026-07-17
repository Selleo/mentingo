import { Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";

import { AI_JUDGE_GENERATION_STATUS } from "./aiJudgeConfiguration.types";
import { AiJudgeGenerationBriefForm } from "./AiJudgeGenerationBriefForm";
import { AiJudgeGenerationProgressView } from "./AiJudgeGenerationProgressView";
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
  onApplyDraft: (draft: AiJudgeConfigurationDraft) => Promise<void> | void;
  onEditAssessment?: (draft: AiJudgeConfigurationDraft) => void;
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
  onApplyDraft,
  onEditAssessment,
}: AiJudgeGenerationDialogProps) => {
  const { t } = useTranslation();
  const active = state ? isGenerationActive(state.status) : false;

  const content = (() => {
    if (!state) return <AiJudgeGenerationBriefForm mode={mode} onGenerate={onGenerate} />;

    switch (state.status) {
      case AI_JUDGE_GENERATION_STATUS.DRAFTING:
      case AI_JUDGE_GENERATION_STATUS.EVALUATING:
      case AI_JUDGE_GENERATION_STATUS.REVISING:
        return (
          <AiJudgeGenerationProgressView
            state={state}
            onCancel={onCancel}
            onStopAndInspect={onStopAndInspect}
          />
        );
      case AI_JUDGE_GENERATION_STATUS.COMPLETED:
      case AI_JUDGE_GENERATION_STATUS.REQUIRES_REVIEW:
        return (
          <AiJudgeGenerationReviewView
            state={state}
            onApplyDraft={onApplyDraft}
            onEditAssessment={onEditAssessment}
          />
        );
      case AI_JUDGE_GENERATION_STATUS.FAILED:
      case AI_JUDGE_GENERATION_STATUS.CANCELLED:
        return <AiJudgeGenerationTerminalView state={state} onOpenChange={onOpenChange} />;
    }
  })();

  return (
    <Dialog open={open} onOpenChange={active ? () => undefined : onOpenChange}>
      <DialogContent
        className="flex max-h-[90dvh] w-[calc(100%-2rem)] max-w-3xl flex-col gap-0 overflow-hidden p-0"
        noCloseButton={active}
      >
        <DialogHeader className="px-6 pb-5 pt-6 pr-12">
          <div className="mb-3 flex size-10 items-center justify-center rounded-lg border border-primary-200 bg-primary-50 text-primary-700">
            <Sparkles className="size-5" aria-hidden />
          </div>
          <DialogTitle className="text-xl text-neutral-950">
            {t(`adminCourseView.curriculum.lesson.aiJudge.generation.${mode}.title`)}
          </DialogTitle>
          <DialogDescription className="text-neutral-600">
            {t(`adminCourseView.curriculum.lesson.aiJudge.generation.${mode}.description`)}
          </DialogDescription>
        </DialogHeader>

        {state && (
          <div className="px-6">
            <AiJudgeGenerationStageTracker status={state.status} />
          </div>
        )}

        <div className="min-h-0 overflow-y-auto px-6 pb-6 pt-5">{content}</div>
      </DialogContent>
    </Dialog>
  );
};
