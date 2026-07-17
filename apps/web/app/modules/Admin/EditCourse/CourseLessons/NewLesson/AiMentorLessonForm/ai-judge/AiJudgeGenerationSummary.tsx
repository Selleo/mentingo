import { Check, Circle, CircleAlert, LoaderCircle, Scale } from "lucide-react";
import { useTranslation } from "react-i18next";

import { AI_JUDGE_GENERATION_CHECK_STATUS } from "./aiJudgeConfiguration.types";

import type {
  AiJudgeConfigurationDraft,
  AiJudgeGenerationCheck,
} from "./aiJudgeConfiguration.types";

const AiJudgeGenerationCheckRow = ({ check }: { check: AiJudgeGenerationCheck }) => {
  const icon = (() => {
    switch (check.status) {
      case AI_JUDGE_GENERATION_CHECK_STATUS.PASSED:
        return <Check className="size-4 text-success-700" aria-hidden />;
      case AI_JUDGE_GENERATION_CHECK_STATUS.IN_PROGRESS:
        return <LoaderCircle className="size-4 animate-spin text-primary-700" aria-hidden />;
      case AI_JUDGE_GENERATION_CHECK_STATUS.NEEDS_ATTENTION:
        return <CircleAlert className="size-4 text-warning-700" aria-hidden />;
      case AI_JUDGE_GENERATION_CHECK_STATUS.PENDING:
        return <Circle className="size-4 text-neutral-400" aria-hidden />;
    }
  })();

  return (
    <li className="flex items-center gap-2 rounded-md border border-neutral-200 px-3 py-2 text-sm text-neutral-800">
      {icon}
      <span>{check.label}</span>
    </li>
  );
};

export const AiJudgeGenerationCheckList = ({ checks }: { checks: AiJudgeGenerationCheck[] }) => (
  <ul className="grid gap-2">
    {checks.map((check) => (
      <AiJudgeGenerationCheckRow key={check.id} check={check} />
    ))}
  </ul>
);

export const AiJudgeGenerationDraftSummary = ({ draft }: { draft: AiJudgeConfigurationDraft }) => {
  const { t } = useTranslation();
  const totalScore = draft.criteria.reduce((sum, criterion) => sum + criterion.maxScore, 0);

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <div className="flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-700">
          <Scale className="size-4" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-neutral-950">{draft.taskGoal}</p>
          <p className="mt-1 text-sm text-neutral-600">
            {t("adminCourseView.curriculum.lesson.aiJudge.generation.draftSummary", {
              criteria: draft.criteria.length,
              score: totalScore,
              threshold: draft.passingThresholdPercent,
              blockingErrors: draft.blockingErrors.length,
            })}
          </p>
        </div>
      </div>
    </div>
  );
};
