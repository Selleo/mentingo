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
    <details className="mt-2 text-xs text-neutral-600">
      <summary className="cursor-pointer font-medium">
        {t("courseAuthoring.activityRail.assetDetails")}
      </summary>
      <div className="mt-2 max-h-48 space-y-2 overflow-y-auto whitespace-pre-wrap break-words">
        {asset.altText && <p>{asset.altText}</p>}
        {diagnostic && <p>{diagnostic}</p>}
        <p>
          {t("courseAuthoring.activityRail.generatedVisual", { content: asset.source.content })}
        </p>
      </div>
    </details>
  );
}
