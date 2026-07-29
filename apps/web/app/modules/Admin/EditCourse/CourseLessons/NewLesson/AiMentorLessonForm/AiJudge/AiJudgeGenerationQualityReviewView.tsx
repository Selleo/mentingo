import { useTranslation } from "react-i18next";

import {
  AI_JUDGE_GENERATION_CHECK_STATUS,
  AI_JUDGE_GENERATION_MODE,
} from "./aiJudgeConfiguration.types";
import { AiJudgeGenerationAttemptHistory } from "./AiJudgeGenerationAttemptHistory";
import {
  AiJudgeGenerationChangeDisclosure,
  AiJudgeGenerationFindingList,
} from "./AiJudgeGenerationSummary";

import type {
  AiJudgeGenerationMode,
  AiJudgeGenerationViewState,
} from "./aiJudgeConfiguration.types";

type AiJudgeGenerationQualityReviewViewProps = {
  state: AiJudgeGenerationViewState;
  mode: AiJudgeGenerationMode;
};

export const AiJudgeGenerationQualityReviewView = ({
  state,
  mode,
}: AiJudgeGenerationQualityReviewViewProps) => {
  const { t } = useTranslation();
  const draft = state.draft;
  const findings = state.evaluatorChecks.filter(
    ({ status }) => status === AI_JUDGE_GENERATION_CHECK_STATUS.NEEDS_ATTENTION,
  );

  if (!draft) return null;

  return (
    <div className="space-y-6">
      <div className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary-700">
          {t("adminCourseView.curriculum.lesson.aiJudge.generation.qualityCheckLabel")}
        </p>
        <h2 className="mt-1 text-xl font-semibold text-neutral-950">
          {t("adminCourseView.curriculum.lesson.aiJudge.generation.qualityDecisionTitle", {
            count: findings.length,
          })}
        </h2>
        <p className="mt-1 text-sm text-neutral-600">
          {t("adminCourseView.curriculum.lesson.aiJudge.generation.qualityDecisionDescription", {
            count: findings.length,
          })}
        </p>
      </div>

      <section aria-labelledby="ai-judge-quality-feedback-heading">
        <h3
          id="ai-judge-quality-feedback-heading"
          className="mb-2 text-sm font-semibold text-neutral-900"
        >
          {t("adminCourseView.curriculum.lesson.aiJudge.generation.suggestedImprovements")}
        </h3>
        <AiJudgeGenerationFindingList checks={findings} />
      </section>

      <AiJudgeGenerationChangeDisclosure changes={state.changes} />

      {mode === AI_JUDGE_GENERATION_MODE.IMPROVE && (
        <AiJudgeGenerationAttemptHistory attempts={state.attemptHistory} collapsed />
      )}
    </div>
  );
};
