import type { CurriculumPreview } from "../courseAuthoring.types";

/** Keep a selected proposal group while refreshing its session-owned asset readiness. */
export const syncReviewPreview = (
  active: CurriculumPreview | null,
  latest: CurriculumPreview,
): CurriculumPreview | null => {
  if (!active) return null;
  if (active.proposalId === latest.proposalId) return latest;
  if (!active.authoringSessionId || active.authoringSessionId !== latest.authoringSessionId)
    return active;
  return { ...active, readyAssetIds: latest.readyAssetIds };
};
