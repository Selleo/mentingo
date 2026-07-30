import { Check, LoaderCircle } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import { DialogFooter } from "~/components/ui/dialog";

import { AI_JUDGE_GENERATION_MODE, AI_JUDGE_GENERATION_STATUS } from "./aiJudgeConfiguration.types";
import { AiJudgeGenerationAttemptHistory } from "./AiJudgeGenerationAttemptHistory";
import {
  AiJudgeGenerationChangeDisclosure,
  AiJudgeGenerationCheckList,
  AiJudgeGenerationDraftSummary,
} from "./AiJudgeGenerationSummary";

import type {
  AiJudgeGenerationMode,
  AiJudgeGenerationViewState,
} from "./aiJudgeConfiguration.types";

type AiJudgeGenerationProgressViewProps = {
  state: AiJudgeGenerationViewState;
  mode: AiJudgeGenerationMode;
  onCancel?: () => Promise<void> | void;
  onStopAndInspect?: () => Promise<void> | void;
};

export const AiJudgeGenerationProgressView = ({
  state,
  mode,
  onCancel,
  onStopAndInspect,
}: AiJudgeGenerationProgressViewProps) => {
  const { t } = useTranslation();
  const isRevising = state.status === AI_JUDGE_GENERATION_STATUS.REVISING;
  const statusDescription =
    isRevising && state.currentCorrection
      ? state.currentCorrection
      : t(`adminCourseView.curriculum.lesson.aiJudge.generation.statusDescription.${state.status}`);

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-neutral-200 bg-white p-5">
        <div className="flex items-start gap-4">
          <LoaderCircle
            className="mt-0.5 size-6 shrink-0 animate-spin text-primary-700"
            aria-hidden
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h2 className="font-semibold text-neutral-950">
                {t(`adminCourseView.curriculum.lesson.aiJudge.generation.status.${state.status}`)}
              </h2>
              <span className="text-sm text-neutral-500">
                {t("adminCourseView.curriculum.lesson.aiJudge.generation.attempt", {
                  attempt: state.attempt,
                  maxAttempts: state.maxAttempts,
                })}
              </span>
            </div>
            <p className="mt-1 text-sm text-neutral-600">{statusDescription}</p>
          </div>
        </div>

        {state.evaluatorChecks.length > 0 && (
          <div className="mt-5 border-t border-neutral-100 pt-5">
            <AiJudgeGenerationCheckList checks={state.evaluatorChecks} />
          </div>
        )}
      </section>

      {state.draft && (mode === AI_JUDGE_GENERATION_MODE.CREATE || state.changes.length > 0) && (
        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-neutral-950">
            {t("adminCourseView.curriculum.lesson.aiJudge.generation.currentDraft")}
          </h3>
          {mode === AI_JUDGE_GENERATION_MODE.CREATE && (
            <AiJudgeGenerationDraftSummary draft={state.draft} />
          )}
          <AiJudgeGenerationChangeDisclosure changes={state.changes} />
        </section>
      )}

      {mode === AI_JUDGE_GENERATION_MODE.IMPROVE && (
        <AiJudgeGenerationAttemptHistory attempts={state.attemptHistory} collapsed />
      )}

      {state.completedArtifacts.length > 0 && state.attemptHistory.length === 0 && (
        <section>
          <p className="mb-2 text-sm font-semibold text-neutral-900">
            {t("adminCourseView.curriculum.lesson.aiJudge.generation.completedArtifacts")}
          </p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {state.completedArtifacts.map((artifact) => (
              <li key={artifact} className="flex items-center gap-2 text-sm text-neutral-700">
                <Check className="size-4 text-success-700" aria-hidden />
                {artifact}
              </li>
            ))}
          </ul>
        </section>
      )}

      <DialogFooter className="gap-2 border-t border-neutral-200 pt-4 sm:space-x-0">
        {state.draft && onStopAndInspect && (
          <Button type="button" variant="outline" onClick={onStopAndInspect}>
            {t("adminCourseView.curriculum.lesson.aiJudge.generation.stopAndInspect")}
          </Button>
        )}
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            {t("adminCourseView.curriculum.lesson.aiJudge.generation.cancel")}
          </Button>
        )}
      </DialogFooter>
    </div>
  );
};
