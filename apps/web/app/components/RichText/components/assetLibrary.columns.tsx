import { RESOURCE_VISIBILITY } from "@repo/shared";
import { formatDate } from "date-fns";
import { Lock, Trash2, Unlock } from "lucide-react";

import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip";

import { RICH_TEXT_HANDLES } from "../../../../e2e/data/common/handles";

import { AssetTypeIcon, formatAssetSize, getAssetDisplayName } from "./assetLibrary.utils";

import type { ColumnDef } from "@tanstack/react-table";
import type { TFunction } from "i18next";
import type { ResourceLibraryAsset } from "~/api/queries/useResourceLibraryAssets";

type GetAssetLibraryColumnsParams = {
  canDelete: boolean;
  canInsert: boolean;
  isMutating: boolean;
  onDelete: (asset: ResourceLibraryAsset) => void;
  onInsert: (asset: ResourceLibraryAsset) => void;
  onVisibilityChange: (asset: ResourceLibraryAsset) => void;
  t: TFunction;
};

export const getAssetLibraryColumns = ({
  canDelete,
  canInsert,
  isMutating,
  onDelete,
  onInsert,
  onVisibilityChange,
  t,
}: GetAssetLibraryColumnsParams): ColumnDef<ResourceLibraryAsset>[] => [
  {
    id: "select",
    header: ({ table }) => {
      const hasSelectableRows = table.getRowModel().rows.some((row) => row.getCanSelect());

      return (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={(checked) => table.toggleAllPageRowsSelected(checked === true)}
          aria-label={t("richText.assetLibrary.visibility.selectAll")}
          disabled={isMutating || !hasSelectableRows}
        />
      );
    },
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(checked) => row.toggleSelected(checked === true)}
        aria-label={t("richText.assetLibrary.visibility.select")}
        disabled={isMutating || !row.getCanSelect()}
      />
    ),
    size: 44,
  },
  {
    id: "asset",
    header: () => t("richText.assetLibrary.columns.asset"),
    cell: ({ row }) => {
      const asset = row.original;
      const fileSize = formatAssetSize(asset.size);

      return (
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md bg-neutral-100">
            <AssetTypeIcon type={asset.type} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex min-w-0 items-center text-sm font-medium text-neutral-950">
              <span className="min-w-0 flex-1 truncate" title={getAssetDisplayName(asset)}>
                {getAssetDisplayName(asset)}
              </span>
              {asset.isNew && (
                <span className="ml-2 shrink-0 rounded bg-primary-100 px-1.5 py-0.5 text-[10px] font-semibold text-primary-800">
                  {t("richText.assetLibrary.visibility.new")}
                </span>
              )}
            </p>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-neutral-600">
              <span>{t(`richText.assetLibrary.types.${asset.type}`)}</span>
              <span>{formatDate(new Date(asset.createdAt), "dd.MM.yyyy")}</span>
              {fileSize && <span>{fileSize}</span>}
              <span>{t("richText.assetLibrary.usageCount", { count: asset.usageCount })}</span>
            </p>
          </div>
        </div>
      );
    },
  },
  {
    id: "actions",
    header: () => t("richText.assetLibrary.columns.actions"),
    cell: ({ row }) => {
      const asset = row.original;
      const visibilityAction = t(
        asset.visibility === RESOURCE_VISIBILITY.PRIVATE
          ? "richText.assetLibrary.visibility.makePublic"
          : "richText.assetLibrary.visibility.makePrivate",
      );

      return (
        <div className="flex items-center justify-end gap-1">
          <Button
            data-testid={RICH_TEXT_HANDLES.assetLibraryInsertButton(asset.id)}
            type="button"
            size="sm"
            variant="outline"
            disabled={!canInsert || isMutating}
            onClick={() => onInsert(asset)}
          >
            {t("richText.assetLibrary.insert")}
          </Button>
          {asset.canChangeVisibility && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="sm"
                  variant={asset.visibility === RESOURCE_VISIBILITY.PRIVATE ? "primary" : "outline"}
                  className="size-9 p-0"
                  disabled={isMutating}
                  aria-label={visibilityAction}
                  onClick={() => onVisibilityChange(asset)}
                >
                  {asset.visibility === RESOURCE_VISIBILITY.PRIVATE ? (
                    <Lock className="size-4" aria-hidden />
                  ) : (
                    <Unlock className="size-4" aria-hidden />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{visibilityAction}</TooltipContent>
            </Tooltip>
          )}
          <Button
            data-testid={RICH_TEXT_HANDLES.assetLibraryDeleteButton(asset.id)}
            type="button"
            size="icon"
            variant="ghost"
            disabled={!canDelete || isMutating}
            aria-label={t("richText.assetLibrary.delete")}
            onClick={() => onDelete(asset)}
          >
            <Trash2 className="size-4" aria-hidden />
          </Button>
        </div>
      );
    },
  },
];
