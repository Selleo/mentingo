import { VoiceJudgeResultDialog, type VoiceJudgeLabels } from "@mentingo/voice";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

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

const EVALUATION_KEY = "studentCourseView.lesson.aiMentorLesson.evaluation";

export function AiMentorEvaluationDialog({
  evaluation,
  open,
  onOpenChange,
  context = AI_MENTOR_EVALUATION_CONTEXT.LESSON,
}: AiMentorEvaluationDialogProps) {
  const { t } = useTranslation();
  const isPractice = context === AI_MENTOR_EVALUATION_CONTEXT.PRACTICE;

  const labels = useMemo<Partial<VoiceJudgeLabels>>(() => {
    const shared: Partial<VoiceJudgeLabels> = {
      kicker: t(`${EVALUATION_KEY}.kicker`),
      scoreTotal: ({ maxScore }) => t(`${EVALUATION_KEY}.scoreTotal`, { maxScore }),
      criterionScore: ({ score, maxScore }) =>
        t(`${EVALUATION_KEY}.criterionScore`, { score, maxScore }),
      criterionFallback: (number) => t("aiMentorPractice.feedback.criterionFallback", { number }),
      tipTitle: t(`${EVALUATION_KEY}.tipTitle`),
      tipNote: t(`${EVALUATION_KEY}.tipNote`),
      noFeedbackTitle: t(`${EVALUATION_KEY}.noFeedbackTitle`),
      noFeedbackDescription: t(`${EVALUATION_KEY}.noFeedbackDescription`),
      close: t("common.button.close"),
    };

    if (isPractice) {
      return {
        ...shared,
        title: t("aiMentorPractice.feedback.title"),
        passedTitle: t("aiMentorPractice.feedback.summaryTitle"),
        failedTitle: t("aiMentorPractice.feedback.summaryTitle"),
        passedDescription: t("aiMentorPractice.feedback.summaryDescription"),
        failedDescription: t("aiMentorPractice.feedback.summaryDescription"),
        summary: ({ percentage }) => t(`${EVALUATION_KEY}.percentage`, { percentage }),
        criteriaTitle: t("aiMentorPractice.feedback.criteriaTitle"),
        criticalErrorsTitle: t("aiMentorPractice.feedback.importantFeedbackTitle"),
      };
    }

    return {
      ...shared,
      title: t(`${EVALUATION_KEY}.title`),
      passedTitle: t(`${EVALUATION_KEY}.passedTitle`),
      failedTitle: t(`${EVALUATION_KEY}.failedTitle`),
      passedDescription: t(`${EVALUATION_KEY}.passedDescription`),
      failedDescription: t(`${EVALUATION_KEY}.failedDescription`),
      summary: ({ percentage, requiredScore, maxScore }) =>
        requiredScore === null
          ? t(`${EVALUATION_KEY}.percentage`, { percentage })
          : t(`${EVALUATION_KEY}.summary`, { percentage, requiredScore, maxScore }),
      criteriaTitle: t(`${EVALUATION_KEY}.criteriaTitle`),
      criticalErrorsTitle: t(`${EVALUATION_KEY}.criticalErrorsTitle`),
    };
  }, [isPractice, t]);

  // Practice feedback has no pass/fail outcome, so it always uses the calm status style.
  const displayedEvaluation = useMemo(
    () => (isPractice ? { ...evaluation, passed: true } : evaluation),
    [evaluation, isPractice],
  );

  return (
    <VoiceJudgeResultDialog
      evaluation={displayedEvaluation}
      open={open}
      onOpenChange={onOpenChange}
      labels={labels}
    />
  );
}
