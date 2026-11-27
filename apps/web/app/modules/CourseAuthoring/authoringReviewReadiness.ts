import { AUTHORING_TASK_KIND, AUTHORING_TASK_STATUS } from "./courseAuthoring.constants";
import { PROPOSAL_DECISION } from "./review/curriculumReview.constants";

import type { AssetTaskView, AuthoringTask, ProposalView } from "./courseAuthoring.types";

const terminalStatuses = new Set<AuthoringTask["status"]>([
  AUTHORING_TASK_STATUS.SUCCEEDED,
  AUTHORING_TASK_STATUS.FAILED,
  AUTHORING_TASK_STATUS.SUPERSEDED,
  AUTHORING_TASK_STATUS.STOPPED,
]);

/**
 * Failed siblings allow review of saved results. Pending podcasts may be inspected
 * during generation, while application waits for their ready asset records.
 */
export const requestGenerationPending = (
  tasks: AuthoringTask[],
  requestId: string,
  proposals: ProposalView[],
  assets: AssetTaskView[] = [],
  omittedOptionalAssetIds: string[] = [],
  inspectPendingPodcasts = false,
): boolean =>
  tasks.some((task) => {
    if (task.requestId !== requestId || terminalStatuses.has(task.status)) return false;
    const skipped =
      task.kind === AUTHORING_TASK_KIND.ASSET &&
      assets.some((asset) => {
        if (asset.taskId !== task.taskId) return false;
        if (asset.request.purpose === "podcast") return inspectPendingPodcasts;
        return !asset.request.required && omittedOptionalAssetIds.includes(asset.request.assetId);
      });
    if (skipped) return false;
    if (task.status === AUTHORING_TASK_STATUS.WAITING_AUTHOR) {
      return !proposals.some(
        (proposal) =>
          proposal.taskId === task.taskId &&
          (proposal.decision === PROPOSAL_DECISION.PENDING ||
            proposal.decision === PROPOSAL_DECISION.ACCEPTED) &&
          proposal.id === task.outputId,
      );
    }
    return true;
  });
