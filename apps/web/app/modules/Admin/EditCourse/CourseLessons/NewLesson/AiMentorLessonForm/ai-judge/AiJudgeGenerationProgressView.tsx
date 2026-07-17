import { Check, LoaderCircle } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import { DialogFooter } from "~/components/ui/dialog";

import { AI_JUDGE_GENERATION_STATUS } from "./aiJudgeConfiguration.types";
import { AiJudgeGenerationCheckList } from "./AiJudgeGenerationSummary";

import type { AiJudgeGenerationViewState } from "./aiJudgeConfiguration.types";

type AiJudgeGenerationProgressViewProps = {
  state: AiJudgeGenerationViewState;
  onCancel?: () => Promise<void> | void;
  onStopAndInspect?: () => Promise<void> | void;
};

export const AiJudgeGenerationProgressView = ({
  state,
  onCancel,
  onStopAndInspect,
}: AiJudgeGenerationProgressViewProps) => {
  const { t } = useTranslation();
  const isRevising = state.status === AI_JUDGE_GENERATION_STATUS.REVISING;

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-4 rounded-lg border border-neutral-200 p-4">
        <LoaderCircle
          className="mt-0.5 size-6 shrink-0 animate-spin text-primary-700"
          aria-hidden
        />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="font-semibold text-neutral-950">
              {t(`adminCourseView.curriculum.lesson.aiJudge.generation.status.${state.status}`)}
            </p>
            <span className="text-sm text-neutral-500">
              {t("adminCourseView.curriculum.lesson.aiJudge.generation.attempt", {
                attempt: state.attempt,
                maxAttempts: state.maxAttempts,
              })}
            </span>
          </div>
          <p className="mt-1 text-sm text-neutral-600">
            {isRevising && state.currentCorrection
              ? state.currentCorrection
              : t(
                  `adminCourseView.curriculum.lesson.aiJudge.generation.statusDescription.${state.status}`,
                )}
          </p>
        </div>
      </div>

      {state.completedArtifacts.length > 0 && (
        <div>
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
        </div>
      )}

      {state.evaluatorChecks.length > 0 && (
        <AiJudgeGenerationCheckList checks={state.evaluatorChecks} />
      )}

      <DialogFooter className="gap-2 sm:space-x-0">
        {state.draft && onStopAndInspect && (
          <Button type="button" variant="outline" onClick={onStopAndInspect}>
            {t("adminCourseView.curriculum.lesson.aiJudge.generation.stopAndInspect")}
          </Button>
        )}
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            {t("adminCourseView.curriculum.lesson.aiJudge.generation.cancel")}
          </Button>
        )}
      </DialogFooter>
    </div>
  );
};
