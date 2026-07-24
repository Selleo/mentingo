import { AlertCircle, CircleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import { DialogFooter } from "~/components/ui/dialog";

import { AI_JUDGE_GENERATION_STATUS } from "./aiJudgeConfiguration.types";

import type { AiJudgeGenerationViewState } from "./aiJudgeConfiguration.types";

type AiJudgeGenerationTerminalViewProps = {
  state: AiJudgeGenerationViewState;
  onOpenChange: (open: boolean) => void;
};

export const AiJudgeGenerationTerminalView = ({
  state,
  onOpenChange,
}: AiJudgeGenerationTerminalViewProps) => {
  const { t } = useTranslation();
  const isFailed = state.status === AI_JUDGE_GENERATION_STATUS.FAILED;

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 rounded-lg border border-neutral-200 p-4">
        {isFailed ? (
          <AlertCircle className="mt-0.5 size-5 shrink-0 text-error-700" aria-hidden />
        ) : (
          <CircleAlert className="mt-0.5 size-5 shrink-0 text-neutral-600" aria-hidden />
        )}
        <div>
          <p className="font-semibold text-neutral-950">
            {t(`adminCourseView.curriculum.lesson.aiJudge.generation.status.${state.status}`)}
          </p>
          <p className="mt-1 text-sm text-neutral-600">
            {t(
              `adminCourseView.curriculum.lesson.aiJudge.generation.statusDescription.${state.status}`,
            )}
          </p>
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          {t("common.button.close")}
        </Button>
      </DialogFooter>
    </div>
  );
};
