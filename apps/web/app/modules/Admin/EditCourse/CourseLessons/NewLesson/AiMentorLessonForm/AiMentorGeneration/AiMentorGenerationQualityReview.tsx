import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import { DialogFooter } from "~/components/ui/dialog";

import {
  AiMentorGenerationChangeDisclosure,
  AiMentorGenerationFindingList,
} from "./AiMentorGenerationSummary";

import type { AiMentorGenerationViewState } from "./aiMentorGeneration.types";

export const AiMentorGenerationQualityReviewView = ({
  state,
}: {
  state: AiMentorGenerationViewState;
}) => {
  const { t } = useTranslation();
  const findings = state.quality?.findings ?? [];

  if (!state.draft) return null;

  return (
    <div className="space-y-6">
      <div className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary-700">
          {t("adminCourseView.curriculum.lesson.aiMentorGeneration.qualityCheckLabel")}
        </p>
        <h2 className="mt-1 text-xl font-semibold text-neutral-950">
          {t("adminCourseView.curriculum.lesson.aiMentorGeneration.qualityDecisionTitle", {
            count: findings.length,
          })}
        </h2>
        <p className="mt-1 text-sm text-neutral-600">
          {t("adminCourseView.curriculum.lesson.aiMentorGeneration.qualityDecisionDescription")}
        </p>
      </div>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-neutral-900">
          {t("adminCourseView.curriculum.lesson.aiMentorGeneration.suggestedImprovements")}
        </h3>
        <AiMentorGenerationFindingList findings={findings} />
      </section>

      <AiMentorGenerationChangeDisclosure changes={state.changes} />
    </div>
  );
};

export const AiMentorGenerationQualityReviewFooter = ({
  state,
  onRevise,
  onContinue,
}: {
  state: AiMentorGenerationViewState;
  onRevise: () => Promise<void> | void;
  onContinue: () => void;
}) => {
  const { t } = useTranslation();

  if (!state.draft) return null;

  return (
    <div
      data-testid="ai-mentor-generation-quality-footer"
      className="shrink-0 border-t border-neutral-200 bg-white px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:px-6 sm:pb-4"
    >
      <DialogFooter className="gap-2 sm:space-x-0">
        <Button type="button" variant="outline" onClick={onRevise}>
          {t("adminCourseView.curriculum.lesson.aiMentorGeneration.applyImprovements")}
        </Button>
        <Button type="button" onClick={onContinue}>
          {t("adminCourseView.curriculum.lesson.aiMentorGeneration.useCurrentDraft")}
        </Button>
      </DialogFooter>
    </div>
  );
};
