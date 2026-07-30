import { LoaderCircle } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import { DialogFooter } from "~/components/ui/dialog";

import { AI_MENTOR_GENERATION_MODE } from "./aiMentorGeneration.types";
import {
  AiMentorGenerationChangeDisclosure,
  AiMentorGenerationDraftSummary,
} from "./AiMentorGenerationSummary";

import type {
  AiMentorGenerationMode,
  AiMentorGenerationViewState,
} from "./aiMentorGeneration.types";

type AiMentorGenerationProgressViewProps = {
  state: AiMentorGenerationViewState;
  mode: AiMentorGenerationMode;
  onCancel?: () => Promise<void> | void;
};

export const AiMentorGenerationProgressView = ({
  state,
  mode,
  onCancel,
}: AiMentorGenerationProgressViewProps) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-neutral-200 bg-white p-5">
        <div className="flex items-start gap-4">
          <LoaderCircle
            className="mt-0.5 size-6 shrink-0 animate-spin text-primary-700"
            aria-hidden
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h2 className="font-semibold text-neutral-950">
                {t(`adminCourseView.curriculum.lesson.aiMentorGeneration.status.${state.status}`)}
              </h2>
              <span className="text-sm text-neutral-500">
                {t("adminCourseView.curriculum.lesson.aiMentorGeneration.attempt", {
                  attempt: state.attempt,
                  maxAttempts: state.maxAttempts,
                })}
              </span>
            </div>
            <p className="mt-1 text-sm text-neutral-600">
              {t(
                `adminCourseView.curriculum.lesson.aiMentorGeneration.statusDescription.${state.status}`,
              )}
            </p>
          </div>
        </div>
      </section>

      {state.draft && (
        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-neutral-950">
            {t("adminCourseView.curriculum.lesson.aiMentorGeneration.currentDraft")}
          </h3>
          {mode === AI_MENTOR_GENERATION_MODE.CREATE && (
            <AiMentorGenerationDraftSummary draft={state.draft} />
          )}
          <AiMentorGenerationChangeDisclosure changes={state.changes} />
        </section>
      )}

      <DialogFooter className="gap-2 border-t border-neutral-200 pt-4 sm:space-x-0">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            {t("adminCourseView.curriculum.lesson.aiMentorGeneration.cancel")}
          </Button>
        )}
      </DialogFooter>
    </div>
  );
};
