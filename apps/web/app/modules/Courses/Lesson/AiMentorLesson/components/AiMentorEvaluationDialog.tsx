import { CheckCircle2, XCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { cn } from "~/lib/utils";
import { variants } from "~/modules/Courses/Lesson/AiMentorLesson/components/variants";

import { LEARNING_HANDLES } from "../../../../../../e2e/data/learning/handles";

import type { AiMentorEvaluation } from "./AiMentorEvaluationDialog.types";

type AiMentorEvaluationDialogProps = {
  evaluation: AiMentorEvaluation;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const resolveRequiredScore = (evaluation: AiMentorEvaluation) => {
  if (evaluation.minScore != null) return evaluation.minScore;
  if (evaluation.requiredScore != null && evaluation.maxScore != null && evaluation.maxScore > 0) {
    return Math.ceil((evaluation.requiredScore * evaluation.maxScore) / 100);
  }

  return null;
};

const resolveThresholdPercentage = (
  evaluation: AiMentorEvaluation,
  requiredScore: number | null,
) => {
  if (evaluation.requiredScore != null) return Math.round(evaluation.requiredScore);
  if (requiredScore !== null && evaluation.maxScore != null && evaluation.maxScore > 0) {
    return Math.ceil((requiredScore / evaluation.maxScore) * 100);
  }

  return null;
};

export function AiMentorEvaluationDialog({
  evaluation,
  open,
  onOpenChange,
}: AiMentorEvaluationDialogProps) {
  const { t } = useTranslation();
  const passed = Boolean(evaluation.passed);
  const score = evaluation.score ?? 0;
  const maxScore = evaluation.maxScore ?? 0;
  const percentage = evaluation.percentage ?? 0;
  const requiredScore = resolveRequiredScore(evaluation);
  const thresholdPercentage = resolveThresholdPercentage(evaluation, requiredScore);
  const hasScore = maxScore > 0;
  const statusLabel = passed
    ? t("studentCourseView.lesson.aiMentorLesson.evaluation.passedTitle")
    : t("studentCourseView.lesson.aiMentorLesson.evaluation.failedTitle");
  const statusDescription = passed
    ? t("studentCourseView.lesson.aiMentorLesson.evaluation.passedDescription")
    : t("studentCourseView.lesson.aiMentorLesson.evaluation.failedDescription");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-neutral-100 px-6 py-4 text-left">
          <DialogTitle className="text-lg font-semibold text-neutral-950">
            {t("studentCourseView.lesson.aiMentorLesson.resultButton")}
          </DialogTitle>
          <DialogDescription className="sr-only">{statusDescription}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 px-6 py-5">
          <DialogHeader
            className={cn(
              "flex flex-row items-start gap-3 space-y-0 rounded-md border bg-white p-4 text-left",
              {
                "border-emerald-200": passed,
                "border-red-200": !passed,
              },
            )}
          >
            <span
              className={cn("mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md", {
                "bg-emerald-50 text-emerald-700": passed,
                "bg-red-50 text-red-700": !passed,
              })}
            >
              {passed ? <CheckCircle2 className="size-5" /> : <XCircle className="size-5" />}
            </span>
            <div className="grid gap-1">
              <h3 className="text-base font-semibold text-neutral-950">{statusLabel}</h3>
              <p className="text-sm leading-relaxed text-neutral-600">{statusDescription}</p>
            </div>
          </DialogHeader>

          {hasScore && (
            <div className="grid gap-3 rounded-md border border-neutral-200 bg-neutral-50/70 p-4 sm:grid-cols-2">
              <div className="grid gap-1">
                <span className="text-xs font-medium text-neutral-500">
                  {t("studentCourseView.lesson.aiMentorLesson.evaluation.scoreLabel")}
                </span>
                <span className="text-base font-semibold text-neutral-950">
                  {t("studentCourseView.lesson.aiMentorLesson.evaluation.scoreValue", {
                    score,
                    maxScore,
                    percentage,
                  })}
                </span>
              </div>
              {requiredScore !== null && thresholdPercentage !== null && (
                <div className="grid gap-1">
                  <span className="text-xs font-medium uppercase text-neutral-500">
                    {t("studentCourseView.lesson.aiMentorLesson.evaluation.thresholdLabel")}
                  </span>
                  <span className="text-lg font-semibold text-neutral-950">
                    {t("studentCourseView.lesson.aiMentorLesson.evaluation.thresholdValue", {
                      requiredScore,
                      maxScore,
                      threshold: thresholdPercentage,
                    })}
                  </span>
                </div>
              )}
            </div>
          )}

          {evaluation.summary && (
            <div className="grid gap-2">
              <h3 className="text-sm font-semibold text-neutral-950">
                {t("studentCourseView.lesson.aiMentorLesson.evaluation.feedbackTitle")}
              </h3>
              <div className="max-h-60 overflow-y-auto rounded-md border border-neutral-200 bg-white p-4 text-sm leading-relaxed text-neutral-700 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:space-y-1 [&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_strong]:font-semibold [&_strong]:text-neutral-950 [&_ul]:my-2 [&_ul]:space-y-1">
                <Markdown components={variants} remarkPlugins={[remarkGfm]}>
                  {evaluation.summary}
                </Markdown>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="border-t border-neutral-100 px-6 py-4">
          <Button
            data-testid={LEARNING_HANDLES.AI_MENTOR_RESULT_CLOSE_BUTTON}
            type="button"
            variant="primary"
            onClick={() => onOpenChange(false)}
          >
            {t("common.button.close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
