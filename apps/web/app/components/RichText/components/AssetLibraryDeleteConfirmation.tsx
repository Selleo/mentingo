import { ArrowLeft, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";

import { RICH_TEXT_HANDLES } from "../../../../e2e/data/common/handles";

import { getAssetDisplayName } from "./assetLibrary.utils";

import type { ResourceLibraryAsset } from "~/api/queries/useResourceLibraryAssets";
import type { ResourceLibraryAssetUsage } from "~/api/queries/useResourceLibraryAssetUsages";

type AssetLibraryDeleteConfirmationProps = {
  asset: ResourceLibraryAsset;
  usages: ResourceLibraryAssetUsage[];
  isLoadingUsages: boolean;
  isDeleting: boolean;
  onBack: () => void;
  onCancel: () => void;
  onConfirm: () => void;
};

export const AssetLibraryDeleteConfirmation = ({
  asset,
  usages,
  isLoadingUsages,
  isDeleting,
  onBack,
  onCancel,
  onConfirm,
}: AssetLibraryDeleteConfirmationProps) => {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-4">
      <Button
        data-testid={RICH_TEXT_HANDLES.ASSET_LIBRARY_BACK_BUTTON}
        type="button"
        variant="ghost"
        className="w-fit px-4 flex items-center gap-2"
        onClick={onBack}
      >
        <ArrowLeft className="size-4" aria-hidden />
        {t("common.button.back")}
      </Button>
      <div className="rounded-md border border-red-200 bg-red-50 p-4">
        <p className="text-sm font-semibold text-red-900">
          {t("richText.assetLibrary.deleteConfirmation.title", {
            name: getAssetDisplayName(asset),
          })}
        </p>
        <p className="mt-1 text-sm text-red-800">
          {t("richText.assetLibrary.deleteConfirmation.description")}
        </p>
      </div>
      <div className="rounded-md border border-neutral-200">
        <div className="border-b border-neutral-100 px-3 py-2 text-xs font-medium uppercase text-neutral-500">
          {t("richText.assetLibrary.deleteConfirmation.usages")}
        </div>
        {isLoadingUsages ? (
          <div className="flex items-center px-3 py-6 text-sm text-neutral-600">
            <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
            {t("richText.assetLibrary.loadingUsages")}
          </div>
        ) : usages.length ? (
          <div className="max-h-[260px] overflow-y-auto">
            {usages.map((usage) => (
              <div
                key={`${usage.entityType}-${usage.entityId}`}
                className="flex items-center justify-between gap-3 border-b border-neutral-100 px-3 py-2 last:border-b-0"
              >
                <span className="truncate text-sm text-neutral-900">{usage.title}</span>
                <span className="shrink-0 text-xs text-neutral-600">
                  {t(`richText.assetLibrary.entities.${usage.entityType}`)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-3 py-6 text-sm text-neutral-600">
            {t("richText.assetLibrary.deleteConfirmation.noUsages")}
          </div>
        )}
      </div>
      <div className="flex justify-end gap-2">
        <Button
          data-testid={RICH_TEXT_HANDLES.ASSET_LIBRARY_DELETE_CANCEL_BUTTON}
          type="button"
          variant="outline"
          onClick={onCancel}
        >
          {t("common.button.cancel")}
        </Button>
        <Button
          data-testid={RICH_TEXT_HANDLES.ASSET_LIBRARY_DELETE_CONFIRM_BUTTON}
          type="button"
          variant="destructive"
          disabled={isDeleting || isLoadingUsages}
          onClick={onConfirm}
        >
          {isDeleting && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />}
          {t("richText.assetLibrary.delete")}
        </Button>
      </div>
    </div>
  );
};
