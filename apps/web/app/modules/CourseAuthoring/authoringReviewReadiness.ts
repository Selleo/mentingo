/** Keeps completed proposals out of review while their request can still produce more work. */
import type { AssetTaskView, AuthoringTask, ProposalView } from "./courseAuthoring.types";

const terminalStatuses = new Set<AuthoringTask["status"]>([
  "succeeded",
  "failed",
  "superseded",
  "stopped",
]);

/** Failed siblings allow saved results to be reviewed; unfinished siblings and assets do not. */
export const requestGenerationPending = (
  tasks: AuthoringTask[],
  requestId: string,
  proposals: ProposalView[],
  assets: AssetTaskView[] = [],
  omittedOptionalAssetIds: string[] = [],
): boolean =>
  tasks.some((task) => {
    if (task.requestId !== requestId || terminalStatuses.has(task.status)) return false;
    const skipped =
      task.kind === "asset" &&
      assets.some(
        (asset) =>
          asset.taskId === task.taskId &&
          !asset.request.required &&
          omittedOptionalAssetIds.includes(asset.request.assetId),
      );
    if (skipped) return false;
    if (task.status === "waiting_author") {
      return !proposals.some(
        (proposal) =>
          proposal.taskId === task.taskId &&
          (proposal.decision === "pending" || proposal.decision === "accepted") &&
          proposal.id === task.outputId,
      );
    }
    return true;
  });
