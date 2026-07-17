import { Check, CircleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import { DialogFooter } from "~/components/ui/dialog";
import { cn } from "~/lib/utils";

import { AI_JUDGE_GENERATION_STATUS } from "./aiJudgeConfiguration.types";
import {
  AiJudgeGenerationCheckList,
  AiJudgeGenerationDraftSummary,
} from "./AiJudgeGenerationSummary";

import type {
  AiJudgeConfigurationDraft,
  AiJudgeGenerationViewState,
} from "./aiJudgeConfiguration.types";

type AiJudgeGenerationReviewViewProps = {
  state: AiJudgeGenerationViewState;
  onApplyDraft: (draft: AiJudgeConfigurationDraft) => Promise<void> | void;
  onEditAssessment?: (draft: AiJudgeConfigurationDraft) => void;
};

export const AiJudgeGenerationReviewView = ({
  state,
  onApplyDraft,
  onEditAssessment,
}: AiJudgeGenerationReviewViewProps) => {
  const { t } = useTranslation();
  const requiresReview = state.status === AI_JUDGE_GENERATION_STATUS.REQUIRES_REVIEW;
  const draft = state.draft;

  if (!draft) return null;

  const titleKey = requiresReview ? "requiresReviewTitle" : "completedTitle";
  const description =
    requiresReview && state.remainingConcern
      ? state.remainingConcern
      : t("adminCourseView.curriculum.lesson.aiJudge.generation.review.completedDescription");

  return (
    <div className="space-y-5">
      <div
        className={cn("rounded-lg border p-4", {
          "border-warning-300 bg-warning-50": requiresReview,
          "border-success-300 bg-success-50": !requiresReview,
        })}
      >
        <div className="flex items-start gap-3">
          {requiresReview ? (
            <CircleAlert className="mt-0.5 size-5 shrink-0 text-warning-800" aria-hidden />
          ) : (
            <Check className="mt-0.5 size-5 shrink-0 text-success-800" aria-hidden />
          )}
          <div>
            <p className="font-semibold text-neutral-950">
              {t(`adminCourseView.curriculum.lesson.aiJudge.generation.review.${titleKey}`)}
            </p>
            <p className="mt-1 text-sm text-neutral-700">{description}</p>
          </div>
        </div>
      </div>

      <AiJudgeGenerationDraftSummary draft={draft} />

      {state.evaluatorChecks.length > 0 && (
        <AiJudgeGenerationCheckList checks={state.evaluatorChecks} />
      )}

      <p className="text-sm text-neutral-600">
        {t("adminCourseView.curriculum.lesson.aiJudge.generation.review.notSaved")}
      </p>

      <DialogFooter className="gap-2 sm:space-x-0">
        {onEditAssessment && (
          <Button type="button" variant="outline" onClick={() => onEditAssessment(draft)}>
            {t("adminCourseView.curriculum.lesson.aiJudge.generation.editAssessment")}
          </Button>
        )}
        <Button type="button" onClick={() => onApplyDraft(draft)}>
          {t("adminCourseView.curriculum.lesson.aiJudge.generation.applyDraft")}
        </Button>
      </DialogFooter>
    </div>
  );
};
