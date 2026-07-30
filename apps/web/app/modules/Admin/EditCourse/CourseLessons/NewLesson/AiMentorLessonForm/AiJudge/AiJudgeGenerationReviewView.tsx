import { useTranslation } from "react-i18next";

import {
  AI_JUDGE_GENERATION_CHECK_STATUS,
  AI_JUDGE_GENERATION_MODE,
  AI_JUDGE_GENERATION_STATUS,
} from "./aiJudgeConfiguration.types";
import { AiJudgeGenerationAttemptHistory } from "./AiJudgeGenerationAttemptHistory";
import {
  AiJudgeGenerationChangeDisclosure,
  AiJudgeGenerationDraftSummary,
  AiJudgeGenerationFindingList,
} from "./AiJudgeGenerationSummary";

import type {
  AiJudgeGenerationMode,
  AiJudgeGenerationViewState,
} from "./aiJudgeConfiguration.types";

export const AiJudgeGenerationReviewView = ({
  state,
  mode,
  isCurrentDraftReview = false,
}: {
  state: AiJudgeGenerationViewState;
  mode: AiJudgeGenerationMode;
  isCurrentDraftReview?: boolean;
}) => {
  const { t } = useTranslation();
  const requiresReview = state.status === AI_JUDGE_GENERATION_STATUS.REQUIRES_REVIEW;
  const draft = state.draft;
  const findings = state.evaluatorChecks.filter(
    ({ status }) => status === AI_JUDGE_GENERATION_CHECK_STATUS.NEEDS_ATTENTION,
  );
  const titleKey = isCurrentDraftReview
    ? "adminCourseView.curriculum.lesson.aiJudge.generation.review.currentDraftTitle"
    : "adminCourseView.curriculum.lesson.aiJudge.generation.review.requiresReviewTitle";
  let description = "";
  if (requiresReview && state.remainingConcern) description = state.remainingConcern;
  if (isCurrentDraftReview)
    description = t(
      "adminCourseView.curriculum.lesson.aiJudge.generation.review.currentDraftDescription",
    );

  if (!draft) return null;

  return (
    <div className="space-y-5">
      {(requiresReview || isCurrentDraftReview) && (
        <div className="max-w-3xl">
          <h2 className="text-lg font-semibold text-neutral-950">{t(titleKey)}</h2>
          {description && <p className="mt-1 text-sm leading-5 text-neutral-600">{description}</p>}
        </div>
      )}

      {mode === AI_JUDGE_GENERATION_MODE.CREATE && <AiJudgeGenerationDraftSummary draft={draft} />}
      {(requiresReview || isCurrentDraftReview) && (
        <AiJudgeGenerationFindingList checks={findings} />
      )}

      <AiJudgeGenerationChangeDisclosure changes={state.changes} />
      {mode === AI_JUDGE_GENERATION_MODE.IMPROVE && (
        <AiJudgeGenerationAttemptHistory attempts={state.attemptHistory} collapsed />
      )}
    </div>
  );
};
