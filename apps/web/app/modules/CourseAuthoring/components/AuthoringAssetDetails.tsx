import { ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { AssetRequestView } from "../courseAuthoring.types";

/** Keep descriptive alt text available without letting it dominate the decision. */
export function AuthoringAssetTitle({ asset }: { asset: AssetRequestView }) {
  const { t } = useTranslation();
  const title = asset.altText.trim();
  return (
    <p className="line-clamp-2 min-w-0 break-words text-sm font-medium">
      {title && title.length <= 100
        ? title
        : t("courseAuthoring.activityRail.generatedVisualTitle")}
    </p>
  );
}

export function AuthoringAssetDetails({
  asset,
  diagnostic,
}: {
  asset: AssetRequestView;
  diagnostic?: string | null;
}) {
  const { t } = useTranslation();
  return (
    <details className="group text-xs text-neutral-800 open:order-last open:w-full">
      <summary className="flex cursor-pointer list-none items-center gap-1 rounded px-1 py-1 hover:text-neutral-800 [&::-webkit-details-marker]:hidden">
        <ChevronRight className="size-3 transition-transform group-open:rotate-90" />
        {t("courseAuthoring.activityRail.assetDetails")}
      </summary>
      <div className="mt-2 max-h-48 space-y-2 overflow-y-auto whitespace-pre-wrap break-words border-l border-neutral-200 pl-3 text-xs leading-5">
        {asset.altText && <p>{asset.altText}</p>}
        {diagnostic && <p>{diagnostic}</p>}
        <p>
          {t("courseAuthoring.activityRail.generatedVisual", { content: asset.source.content })}
        </p>
      </div>
    </details>
  );
}
