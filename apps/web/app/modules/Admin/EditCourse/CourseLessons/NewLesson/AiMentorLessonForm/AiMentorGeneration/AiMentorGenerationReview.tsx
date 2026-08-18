import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import { DialogFooter } from "~/components/ui/dialog";

import { AI_MENTOR_GENERATION_MODE, AI_MENTOR_GENERATION_STATUS } from "./aiMentorGeneration.types";
import {
  AiMentorGenerationChangeDisclosure,
  AiMentorGenerationDraftSummary,
  AiMentorGenerationFindingList,
} from "./AiMentorGenerationSummary";

import type {
  AiMentorGeneratedDraft,
  AiMentorGenerationMode,
  AiMentorGenerationViewState,
} from "./aiMentorGeneration.types";

export const AiMentorGenerationReviewView = ({
  state,
  mode,
  isCurrentDraftReview = false,
}: {
  state: AiMentorGenerationViewState;
  mode: AiMentorGenerationMode;
  isCurrentDraftReview?: boolean;
}) => {
  const { t } = useTranslation();
  const requiresReview = state.status === AI_MENTOR_GENERATION_STATUS.REQUIRES_REVIEW;
  const findings = state.quality?.findings ?? [];

  if (!state.draft) return null;

  return (
    <div className="space-y-5">
      {(requiresReview || isCurrentDraftReview) && (
        <div className="max-w-3xl">
          <h2 className="text-lg font-semibold text-neutral-950">
            {t(
              isCurrentDraftReview
                ? "adminCourseView.curriculum.lesson.aiMentorGeneration.review.currentDraftTitle"
                : "adminCourseView.curriculum.lesson.aiMentorGeneration.review.requiresReviewTitle",
            )}
          </h2>
          <p className="mt-1 text-sm leading-5 text-neutral-600">
            {t(
              isCurrentDraftReview
                ? "adminCourseView.curriculum.lesson.aiMentorGeneration.review.currentDraftDescription"
                : "adminCourseView.curriculum.lesson.aiMentorGeneration.review.requiresReviewDescription",
            )}
          </p>
        </div>
      )}

      {mode === AI_MENTOR_GENERATION_MODE.CREATE && (
        <AiMentorGenerationDraftSummary draft={state.draft} />
      )}
      {(requiresReview || isCurrentDraftReview) && (
        <AiMentorGenerationFindingList findings={findings} />
      )}
      <AiMentorGenerationChangeDisclosure changes={state.changes} />
    </div>
  );
};

export const AiMentorGenerationReviewFooter = ({
  draft,
  onReviewConfiguration,
}: {
  draft: AiMentorGeneratedDraft;
  onReviewConfiguration: (draft: AiMentorGeneratedDraft) => void;
}) => {
  const { t } = useTranslation();

  return (
    <div className="shrink-0 border-t border-neutral-200 bg-white px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:px-6 sm:pb-4">
      <DialogFooter className="gap-2 sm:space-x-0">
        <Button type="button" onClick={() => onReviewConfiguration(draft)}>
          {t("adminCourseView.curriculum.lesson.aiMentorGeneration.reviewConfiguration")}
        </Button>
      </DialogFooter>
    </div>
  );
};
