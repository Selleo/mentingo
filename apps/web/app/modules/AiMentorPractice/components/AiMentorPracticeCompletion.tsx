import { RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";

import { AI_MENTOR_PRACTICE_HANDLES } from "../../../../e2e/data/ai-mentor-practice/handles";

type AiMentorPracticeCompletionProps = {
  isReplayPending: boolean;
  onViewFeedback: () => void;
  onPracticeAgain: () => void;
};

export function AiMentorPracticeCompletion({
  isReplayPending,
  onViewFeedback,
  onPracticeAgain,
}: AiMentorPracticeCompletionProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-wrap items-center gap-3 py-2">
      <p className="body-sm-md text-neutral-800">{t("aiMentorPractice.practiceComplete")}</p>
      <div className="ml-auto flex items-center justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          data-testid={AI_MENTOR_PRACTICE_HANDLES.VIEW_FEEDBACK_BUTTON}
          onClick={onViewFeedback}
        >
          {t("aiMentorPractice.viewFeedback")}
        </Button>
        <Button
          size="sm"
          data-testid={AI_MENTOR_PRACTICE_HANDLES.PRACTICE_AGAIN_BUTTON}
          className="gap-2"
          disabled={isReplayPending}
          onClick={onPracticeAgain}
        >
          <RotateCcw className="size-4" aria-hidden="true" />
          {t("aiMentorPractice.practiceAgain")}
        </Button>
      </div>
    </div>
  );
}
