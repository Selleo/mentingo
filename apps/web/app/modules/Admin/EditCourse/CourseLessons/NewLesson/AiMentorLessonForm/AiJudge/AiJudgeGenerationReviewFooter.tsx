import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import { DialogFooter } from "~/components/ui/dialog";

import type {
  AiJudgeConfigurationDraft,
  AiJudgeGenerationViewState,
} from "./aiJudgeConfiguration.types";

type AiJudgeGenerationReviewFooterProps = {
  state: AiJudgeGenerationViewState;
  onReviewAssessment: (draft: AiJudgeConfigurationDraft) => void;
};

export const AiJudgeGenerationReviewFooter = ({
  state,
  onReviewAssessment,
}: AiJudgeGenerationReviewFooterProps) => {
  const { t } = useTranslation();
  const draft = state.draft;

  if (!draft) return null;

  return (
    <div className="shrink-0 border-t border-neutral-200 bg-white px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:px-6 sm:pb-4">
      <DialogFooter className="gap-2 sm:space-x-0">
        <Button type="button" onClick={() => onReviewAssessment(draft)}>
          {t("adminCourseView.curriculum.lesson.aiJudge.generation.reviewAssessment")}
        </Button>
      </DialogFooter>
    </div>
  );
};
