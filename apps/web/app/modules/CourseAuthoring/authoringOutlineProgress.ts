import type { AuthoringWorkProgress } from "./courseAuthoring.types";

/** Names actual outline activity; chapter counts describe a provisional draft, not completion. */
export const authoringOutlineProgressLabel = (
  progress: AuthoringWorkProgress,
  t: (key: string, options?: Record<string, unknown>) => string,
) => {
  if (!progress.outlinePhase) return t("courseAuthoring.conversation.planningOutline");
  const labels = [t(`courseAuthoring.conversation.outlineProgress.${progress.outlinePhase}`)];
  if (progress.draftedChapters) {
    labels.push(
      t("courseAuthoring.conversation.outlineProgress.chapters", {
        count: progress.draftedChapters,
      }),
    );
  }
  if (progress.outlineIteration && progress.outlineIteration > 1) {
    labels.push(
      t("courseAuthoring.conversation.outlineProgress.iteration", {
        count: progress.outlineIteration,
      }),
    );
  }
  return labels.join(" · ");
};
