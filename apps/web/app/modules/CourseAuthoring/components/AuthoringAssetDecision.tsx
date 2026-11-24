import { AudioLines, Check, Image, RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

import { AUTHORING_TASK_STATUS } from "../courseAuthoring.constants";

import { AuthoringAssetDetails, AuthoringAssetTitle } from "./AuthoringAssetDetails";

import type { AssetTaskView } from "../courseAuthoring.types";

/** A single, quiet decision row; descriptions and provider prompts remain secondary. */
export function AuthoringAssetDecision({
  asset,
  omitted,
  busy,
  onRetry,
  onSkip,
  onRestore,
}: {
  asset: AssetTaskView;
  omitted: boolean;
  busy?: boolean;
  onRetry: () => void;
  onSkip: () => void;
  onRestore?: () => void;
}) {
  const { t } = useTranslation();
  const podcast = asset.request.purpose === "podcast";
  const required = asset.request.required || podcast;
  let AssetStatusIcon = podcast ? AudioLines : Image;
  if (omitted) AssetStatusIcon = Check;
  const canRetry = asset.action
    ? asset.revision !== null
    : podcast && asset.status === AUTHORING_TASK_STATUS.FAILED;
  let explanationKey = "courseAuthoring.activityRail.assetDecisionFallback";
  if (asset.action) explanationKey = "courseAuthoring.activityRail.retryApprovalExplanation";
  if (podcast) {
    explanationKey = asset.action
      ? "courseAuthoring.activityRail.retryPodcastApproval"
      : "courseAuthoring.review.podcastNotReady";
  }
  let statusKey = "courseAuthoring.activityRail.optional";
  if (required) statusKey = "courseAuthoring.activityRail.required";
  if (omitted) statusKey = "courseAuthoring.review.omitted";
  return (
    <div className="flex items-start gap-3 py-3">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-500">
        <AssetStatusIcon className="size-4" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <AuthoringAssetTitle asset={asset.request} />
          <span className={cn("text-xs", omitted ? "text-success-700" : "text-neutral-800")}>
            {t(statusKey)}
          </span>
        </div>
        {!omitted && (
          <p className="mt-1 max-w-lg text-xs leading-5 text-neutral-800">{t(explanationKey)}</p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {omitted ? (
            <Button type="button" variant="ghost" size="xs" onClick={onRestore}>
              {t("courseAuthoring.activityRail.restoreAsset")}
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 px-2.5 text-xs"
                disabled={busy || !canRetry}
                onClick={onRetry}
              >
                <RotateCcw className="size-3.5" />
                {t(
                  podcast
                    ? "courseAuthoring.activityRail.retryPodcast"
                    : "courseAuthoring.activityRail.approveRetry",
                )}
              </Button>
              {!required && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2.5 text-xs text-neutral-800"
                  onClick={onSkip}
                >
                  {t("courseAuthoring.activityRail.skipOptionalAsset")}
                </Button>
              )}
            </>
          )}
          <AuthoringAssetDetails asset={asset.request} diagnostic={asset.question} />
        </div>
        {!omitted && required && !podcast && (
          <p className="mt-1 text-xs text-neutral-800">
            {t("courseAuthoring.activityRail.requiredCannotSkip")}
          </p>
        )}
      </div>
    </div>
  );
}
