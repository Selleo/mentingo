import type { AssetTaskView } from "./courseAuthoring.types";

/** Podcasts are required unless generation failed terminally; other assets follow their request. */
export const canOmitAuthoringAsset = (asset: AssetTaskView) =>
  asset.request.purpose === "podcast"
    ? asset.terminalFailure && !asset.ready
    : !asset.request.required;

export const omittablePodcastAssetIds = (assetTasks: AssetTaskView[]) =>
  assetTasks
    .filter((asset) => asset.request.purpose === "podcast" && canOmitAuthoringAsset(asset))
    .map((asset) => asset.request.assetId);

export const omittedPodcastAssetIds = (assetTasks: AssetTaskView[], omittedAssetIds: string[]) =>
  omittablePodcastAssetIds(assetTasks).filter((assetId) => omittedAssetIds.includes(assetId));
