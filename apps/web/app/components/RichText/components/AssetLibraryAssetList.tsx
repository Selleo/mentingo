import { FileArchive, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { AssetLibraryAssetItem } from "./AssetLibraryAssetItem";

import type { ResourceLibraryAsset } from "~/api/queries/useResourceLibraryAssets";

type AssetLibraryAssetListProps = {
  assets: ResourceLibraryAsset[];
  isLoading: boolean;
  canInsert: boolean;
  canDelete: boolean;
  isMutating: boolean;
  onInsert: (asset: ResourceLibraryAsset) => void;
  onDelete: (asset: ResourceLibraryAsset) => void;
};

export const AssetLibraryAssetList = ({
  assets,
  isLoading,
  canInsert,
  canDelete,
  isMutating,
  onInsert,
  onDelete,
}: AssetLibraryAssetListProps) => {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="flex min-h-[240px] items-center justify-center text-neutral-600">
        <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
        {t("richText.assetLibrary.loading")}
      </div>
    );
  }

  if (!assets.length) {
    return (
      <div className="flex min-h-[240px] flex-col items-center justify-center gap-2 text-center text-neutral-600">
        <FileArchive className="size-9 text-neutral-400" aria-hidden />
        <p className="text-sm font-medium text-neutral-900">
          {t("richText.assetLibrary.empty.title")}
        </p>
        <p className="max-w-sm text-xs">{t("richText.assetLibrary.empty.description")}</p>
      </div>
    );
  }

  return (
    <div className="max-h-[430px] overflow-y-auto rounded-md border border-neutral-200">
      {assets.map((asset) => (
        <AssetLibraryAssetItem
          key={asset.id}
          asset={asset}
          canInsert={canInsert}
          canDelete={canDelete}
          isMutating={isMutating}
          onInsert={onInsert}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
};
