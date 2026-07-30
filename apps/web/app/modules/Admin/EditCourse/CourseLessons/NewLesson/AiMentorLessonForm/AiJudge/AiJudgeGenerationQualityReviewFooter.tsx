import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import { DialogFooter } from "~/components/ui/dialog";

import type { AiJudgeGenerationViewState } from "./aiJudgeConfiguration.types";

type AiJudgeGenerationQualityReviewFooterProps = {
  state: AiJudgeGenerationViewState;
  onRevise: () => Promise<void> | void;
  isRevising: boolean;
  onContinue: () => void;
};

export const AiJudgeGenerationQualityReviewFooter = ({
  state,
  onRevise,
  isRevising,
  onContinue,
}: AiJudgeGenerationQualityReviewFooterProps) => {
  const { t } = useTranslation();

  if (!state.draft) return null;

  return (
    <div
      data-testid="ai-judge-generation-quality-footer"
      className="shrink-0 border-t border-neutral-200 bg-white px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:px-6 sm:pb-4"
    >
      <DialogFooter className="gap-2 sm:space-x-0">
        <Button type="button" variant="outline" onClick={onRevise} disabled={isRevising}>
          {t("adminCourseView.curriculum.lesson.aiJudge.generation.applyImprovements")}
        </Button>
        <Button type="button" onClick={onContinue}>
          {t("adminCourseView.curriculum.lesson.aiJudge.generation.useCurrentDraft")}
        </Button>
      </DialogFooter>
    </div>
  );
};
