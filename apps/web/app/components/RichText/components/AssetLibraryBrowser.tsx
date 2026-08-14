import { RESOURCE_VISIBILITY } from "@repo/shared";
import { Lock, Search, Unlock, UploadCloud } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Pagination } from "~/components/Pagination/Pagination";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { cn } from "~/lib/utils";

import { RICH_TEXT_HANDLES } from "../../../../e2e/data/common/handles";

import { AssetLibraryAssetList } from "./AssetLibraryAssetList";

import type { EditableResourceVisibility } from "@repo/shared";
import type { OnChangeFn, RowSelectionState } from "@tanstack/react-table";
import type { ChangeEvent, RefObject } from "react";
import type { ResourceLibraryAsset } from "~/api/queries/useResourceLibraryAssets";

type AssetLibraryBrowserProps = {
  assets: ResourceLibraryAsset[];
  acceptedFileTypes: readonly string[];
  canDelete: boolean;
  canUseLibrary: boolean;
  canInsertAsset: boolean;
  canUploadToLibrary: boolean;
  currentPage: number;
  isLoadingAssets: boolean;
  isMutating: boolean;
  isUploadingToLibrary: boolean;
  rowSelection: RowSelectionState;
  search: string;
  selectedAssetCount: number;
  totalAssets: number;
  uploadInputRef: RefObject<HTMLInputElement>;
  onDelete: (asset: ResourceLibraryAsset) => void;
  onInsert: (asset: ResourceLibraryAsset) => void;
  onPageChange: (page: number) => void;
  onSearchChange: (search: string) => void;
  onRowSelectionChange: OnChangeFn<RowSelectionState>;
  onUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  onVisibilityChange: (asset: ResourceLibraryAsset) => void;
  onBulkVisibilityChange: (visibility: EditableResourceVisibility) => void;
};

export const AssetLibraryBrowser = ({
  assets,
  acceptedFileTypes,
  canDelete,
  canUseLibrary,
  canInsertAsset,
  canUploadToLibrary,
  currentPage,
  isLoadingAssets,
  isMutating,
  isUploadingToLibrary,
  rowSelection,
  search,
  selectedAssetCount,
  totalAssets,
  uploadInputRef,
  onDelete,
  onInsert,
  onPageChange,
  onSearchChange,
  onRowSelectionChange,
  onUpload,
  onVisibilityChange,
  onBulkVisibilityChange,
}: AssetLibraryBrowserProps) => {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-0 flex-col gap-4">
      {!canUseLibrary && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {t("richText.assetLibrary.disabledUntilSaved")}
        </div>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-500" />
          <Input
            data-testid={RICH_TEXT_HANDLES.ASSET_LIBRARY_SEARCH_INPUT}
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={t("richText.assetLibrary.searchPlaceholder")}
            className="pl-9"
          />
        </div>
        <Input
          data-testid={RICH_TEXT_HANDLES.ASSET_LIBRARY_UPLOAD_INPUT}
          ref={uploadInputRef}
          type="file"
          className="hidden"
          multiple
          accept={acceptedFileTypes.join(",")}
          onChange={onUpload}
        />
        <Button
          data-testid={RICH_TEXT_HANDLES.ASSET_LIBRARY_UPLOAD_BUTTON}
          type="button"
          disabled={!canUploadToLibrary || isUploadingToLibrary}
          onClick={() => uploadInputRef.current?.click()}
        >
          <UploadCloud
            className={cn("mr-2 size-4", isUploadingToLibrary && "animate-pulse")}
            aria-hidden
          />
          {isUploadingToLibrary ? t("common.button.uploading") : t("richText.assetLibrary.upload")}
        </Button>
      </div>
      <div className="flex items-center justify-between rounded-md bg-neutral-100 px-3 py-2 text-sm">
        <span>{t("richText.assetLibrary.visibility.selected", { count: selectedAssetCount })}</span>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="flex items-center gap-2"
            disabled={isMutating || selectedAssetCount === 0}
            onClick={() => onBulkVisibilityChange(RESOURCE_VISIBILITY.PUBLIC)}
          >
            <Unlock className="size-4" aria-hidden />
            {t("richText.assetLibrary.visibility.makePublic")}
          </Button>
          <Button
            size="sm"
            className="flex items-center gap-2"
            disabled={isMutating || selectedAssetCount === 0}
            onClick={() => onBulkVisibilityChange(RESOURCE_VISIBILITY.PRIVATE)}
          >
            <Lock className="size-4" aria-hidden />
            {t("richText.assetLibrary.visibility.makePrivate")}
          </Button>
        </div>
      </div>
      <AssetLibraryAssetList
        assets={assets}
        isLoading={isLoadingAssets}
        canInsert={canInsertAsset}
        canDelete={canDelete}
        isMutating={isMutating}
        onInsert={onInsert}
        onDelete={onDelete}
        rowSelection={rowSelection}
        onVisibilityChange={onVisibilityChange}
        onRowSelectionChange={onRowSelectionChange}
      />
      <Pagination
        className="px-0"
        emptyDataClassName="hidden"
        totalItems={totalAssets}
        itemsPerPage={10}
        currentPage={currentPage}
        canChangeItemsPerPage={false}
        onPageChange={onPageChange}
      />
    </div>
  );
};
