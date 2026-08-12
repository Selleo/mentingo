import { CheckCircle2, Info, MessageSquareText, ShieldAlert, XCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { P, match } from "ts-pattern";

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

import { AI_MENTOR_PRACTICE_HANDLES } from "../../../../../../e2e/data/ai-mentor-practice/handles";
import { LEARNING_HANDLES } from "../../../../../../e2e/data/learning/handles";

import {
  AI_MENTOR_EVALUATION_CONTEXT,
  type AiMentorEvaluation,
  type AiMentorEvaluationContext,
} from "./AiMentorEvaluationDialog.types";

type AiMentorEvaluationDialogProps = {
  evaluation: AiMentorEvaluation;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context?: AiMentorEvaluationContext;
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
  context = AI_MENTOR_EVALUATION_CONTEXT.LESSON,
}: AiMentorEvaluationDialogProps) {
  const { t } = useTranslation();
  const passed = Boolean(evaluation.passed);
  const score = evaluation.score ?? 0;
  const maxScore = evaluation.maxScore ?? 0;
  const percentage = evaluation.percentage ?? 0;
  const requiredScore = resolveRequiredScore(evaluation);
  const thresholdPercentage = resolveThresholdPercentage(evaluation, requiredScore);
  const hasScore = maxScore > 0;
  const criteria = evaluation.criteria ?? [];
  const blockingErrors = evaluation.blockingErrors ?? [];
  const isPractice = context === AI_MENTOR_EVALUATION_CONTEXT.PRACTICE;
  const statusTitle = match([isPractice, passed])
    .with([true, P._], () => t("aiMentorPractice.feedback.summaryTitle"))
    .with([false, true], () => t("studentCourseView.lesson.aiMentorLesson.evaluation.passedTitle"))
    .otherwise(() => t("studentCourseView.lesson.aiMentorLesson.evaluation.failedTitle"));
  let statusDescription = t("aiMentorPractice.feedback.summaryDescription");
  if (!isPractice) {
    statusDescription = passed
      ? t("studentCourseView.lesson.aiMentorLesson.evaluation.passedDescription")
      : t("studentCourseView.lesson.aiMentorLesson.evaluation.failedDescription");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        variant="mobileDrawer"
        data-testid={isPractice ? AI_MENTOR_PRACTICE_HANDLES.FEEDBACK_DIALOG : undefined}
        className="!flex h-[85dvh] !flex-col sm:h-auto sm:!max-w-xl"
      >
        <DialogHeader className="shrink-0 border-b border-neutral-100 px-6 py-4 text-left">
          <DialogTitle className="text-lg font-semibold text-neutral-950">
            {isPractice
              ? t("aiMentorPractice.feedback.title")
              : t("studentCourseView.lesson.aiMentorLesson.resultButton")}
          </DialogTitle>
          <DialogDescription className="sr-only">{statusDescription}</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overscroll-contain overflow-y-auto px-6 py-5 [-webkit-overflow-scrolling:touch]">
          <div className="grid gap-5">
            <DialogHeader
              className={cn(
                "flex flex-row items-start gap-3 space-y-0 rounded-md border bg-white p-4 text-left",
                {
                  "border-primary-200": isPractice,
                  "border-emerald-200": !isPractice && passed,
                  "border-red-200": !isPractice && !passed,
                },
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md",
                  {
                    "bg-primary-50 text-primary-700": isPractice,
                    "bg-emerald-50 text-emerald-700": !isPractice && passed,
                    "bg-red-50 text-red-700": !isPractice && !passed,
                  },
                )}
              >
                {isPractice ? (
                  <MessageSquareText className="size-5" />
                ) : passed ? (
                  <CheckCircle2 className="size-5" />
                ) : (
                  <XCircle className="size-5" />
                )}
              </span>
              <div className="grid gap-1">
                <h3 className="text-base font-semibold text-neutral-950">{statusTitle}</h3>
                <p className="text-sm leading-relaxed text-neutral-600">{statusDescription}</p>
              </div>
            </DialogHeader>

            {hasScore && (
              <div className="grid gap-3 rounded-md border border-neutral-200 bg-neutral-50/70 p-4 sm:grid-cols-2">
                <div className="grid gap-1">
                  <span className="text-xs font-medium text-neutral-500">
                    {isPractice
                      ? t("aiMentorPractice.feedback.scoreLabel")
                      : t("studentCourseView.lesson.aiMentorLesson.evaluation.scoreLabel")}
                  </span>
                  <span className="text-base font-semibold text-neutral-950">
                    {t("studentCourseView.lesson.aiMentorLesson.evaluation.scoreValue", {
                      score,
                      maxScore,
                      percentage,
                    })}
                  </span>
                </div>
                {!isPractice && requiredScore !== null && thresholdPercentage !== null && (
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

            {blockingErrors.length > 0 && (
              <section className="grid gap-3">
                <div className="flex items-center gap-2">
                  <span className="flex size-7 items-center justify-center rounded-full bg-red-50 text-red-700">
                    <ShieldAlert className="size-4" />
                  </span>
                  <h3 className="text-sm font-semibold text-neutral-950">
                    {isPractice
                      ? t("aiMentorPractice.feedback.importantFeedbackTitle")
                      : t("studentCourseView.lesson.aiMentorLesson.evaluation.criticalErrorsTitle")}
                  </h3>
                </div>
                <div className="overflow-hidden rounded-md border border-neutral-200 bg-white">
                  {blockingErrors.map((blockingError) => (
                    <div
                      key={blockingError.blockingErrorId}
                      className="border-b border-neutral-100 px-4 py-3 last:border-b-0"
                    >
                      <div className="grid gap-1">
                        <p className="text-sm font-semibold text-neutral-950">
                          {blockingError.description}
                        </p>
                        <p className="text-sm leading-relaxed text-neutral-600">
                          {blockingError.learnerSafeFeedback}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {criteria.length > 0 && (
              <section className="grid gap-3">
                <h3 className="text-sm font-semibold text-neutral-950">
                  {isPractice
                    ? t("aiMentorPractice.feedback.criteriaTitle")
                    : t("studentCourseView.lesson.aiMentorLesson.evaluation.criteriaTitle")}
                </h3>
                <div className="grid gap-2">
                  {criteria.map((criterion, index) => (
                    <div
                      key={criterion.criterionId}
                      className="grid gap-2 rounded-md border border-neutral-200 bg-white p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-semibold text-neutral-950">
                          {criterion.title.trim() ||
                            t("aiMentorPractice.feedback.criterionFallback", {
                              number: index + 1,
                              defaultValue: `Criterion ${index + 1}`,
                            })}
                        </p>
                        <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-1 text-xs font-semibold text-neutral-700">
                          {t("studentCourseView.lesson.aiMentorLesson.evaluation.criterionScore", {
                            score: criterion.awardedScore,
                            maxScore: criterion.maxScore,
                          })}
                        </span>
                      </div>
                      <p className="text-sm leading-relaxed text-neutral-600">
                        {criterion.learnerSafeFeedback}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {criteria.length === 0 && blockingErrors.length === 0 && (
              <div className="flex items-start gap-3 rounded-md border border-neutral-200 bg-neutral-50 p-4">
                <Info className="mt-0.5 size-5 shrink-0 text-neutral-500" />
                <div className="grid gap-1">
                  <h3 className="text-sm font-semibold text-neutral-950">
                    {t("studentCourseView.lesson.aiMentorLesson.evaluation.noFeedbackTitle")}
                  </h3>
                  <p className="text-sm leading-relaxed text-neutral-600">
                    {t("studentCourseView.lesson.aiMentorLesson.evaluation.noFeedbackDescription")}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="shrink-0 border-t border-neutral-100 px-6 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
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
