import { formatDate } from "date-fns";
import { Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";

import { RICH_TEXT_HANDLES } from "../../../../e2e/data/common/handles";

import { AssetTypeIcon, formatAssetSize, getAssetDisplayName } from "./assetLibrary.utils";

import type { ResourceLibraryAsset } from "~/api/queries/useResourceLibraryAssets";

type AssetLibraryAssetItemProps = {
  asset: ResourceLibraryAsset;
  hasEntity: boolean;
  isMutating: boolean;
  onInsert: (asset: ResourceLibraryAsset) => void;
  onDelete: (asset: ResourceLibraryAsset) => void;
};

export const AssetLibraryAssetItem = ({
  asset,
  hasEntity,
  isMutating,
  onInsert,
  onDelete,
}: AssetLibraryAssetItemProps) => {
  const { t } = useTranslation();

  const fileSize = formatAssetSize(asset.size);
  const displayName = getAssetDisplayName(asset);

  return (
    <div
      data-testid={RICH_TEXT_HANDLES.assetLibraryRow(asset.id)}
      className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-b border-neutral-100 px-3 py-3 last:border-b-0"
    >
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md bg-neutral-100">
          <AssetTypeIcon type={asset.type} />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-neutral-950">{displayName}</p>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-neutral-600">
            <span>{t(`richText.assetLibrary.types.${asset.type}`)}</span>
            <span>{formatDate(new Date(asset.createdAt), "dd.MM.yyyy")}</span>
            {fileSize && <span>{fileSize}</span>}
            <span>{t("richText.assetLibrary.usageCount", { count: asset.usageCount })}</span>
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Button
          data-testid={RICH_TEXT_HANDLES.assetLibraryInsertButton(asset.id)}
          type="button"
          size="sm"
          variant="outline"
          disabled={!hasEntity || isMutating}
          onClick={() => onInsert(asset)}
        >
          {t("richText.assetLibrary.insert")}
        </Button>
        <Button
          data-testid={RICH_TEXT_HANDLES.assetLibraryDeleteButton(asset.id)}
          type="button"
          size="icon"
          variant="ghost"
          disabled={!hasEntity || isMutating}
          aria-label={t("richText.assetLibrary.delete")}
          onClick={() => onDelete(asset)}
        >
          <Trash2 className="size-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
};
