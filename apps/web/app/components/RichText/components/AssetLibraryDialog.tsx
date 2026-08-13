import {
  RESOURCE_VISIBILITY,
  type EditableResourceVisibility,
  type SupportedLanguages,
} from "@repo/shared";
import { Folder } from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useBulkUpdateResourceLibraryAssetVisibility } from "~/api/mutations/useBulkUpdateResourceLibraryAssetVisibility";
import { useDeleteResourceLibraryAsset } from "~/api/mutations/useDeleteResourceLibraryAsset";
import { useResourceLibraryAssets } from "~/api/queries/useResourceLibraryAssets";
import { useResourceLibraryAssetUsages } from "~/api/queries/useResourceLibraryAssetUsages";
import { insertResourceIntoEditor } from "~/components/RichText/utils/insertResourceIntoEditor";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { useToast } from "~/components/ui/use-toast";
import { useDebounce } from "~/hooks/useDebounce";

import { RICH_TEXT_HANDLES } from "../../../../e2e/data/common/handles";

import {
  getAssetDisplayName,
  getRichTextResourceTypeFromAsset,
  richTextResourceTypeNeedsDisplayMode,
} from "./assetLibrary.utils";
import { AssetLibraryBrowser } from "./AssetLibraryBrowser";
import { AssetLibraryDeleteConfirmation } from "./AssetLibraryDeleteConfirmation";
import {
  AssetLibraryVisibilityConfirmationDialog,
  type VisibilityChangeConfirmation,
} from "./AssetLibraryVisibilityConfirmationDialog";
import { useAssetLibraryUploadHandler } from "./useAssetLibraryUploadHandler";

import type { RowSelectionState } from "@tanstack/react-table";
import type { Editor } from "@tiptap/react";
import type { ResourceLibraryAsset } from "~/api/queries/useResourceLibraryAssets";
import type { RichTextResourceDisplayMode } from "~/components/RichText/utils/richTextResource.types";
import type { RichTextResourceLibraryEntityType } from "~/types/resourceLibrary";

export type AssetLibraryConfig = {
  entityType: RichTextResourceLibraryEntityType;
  entityId?: string;
  contextId?: string;
  language: SupportedLanguages;
};

type AssetLibraryDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editor: Editor;
  config: AssetLibraryConfig;
  acceptedFileTypes: readonly string[];
};

const PER_PAGE = 10;

export const AssetLibraryDialog = ({
  open,
  onOpenChange,
  editor,
  config,
  acceptedFileTypes,
}: AssetLibraryDialogProps) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [assetToDelete, setAssetToDelete] = useState<ResourceLibraryAsset | null>(null);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [visibilityChangeConfirmation, setVisibilityChangeConfirmation] =
    useState<VisibilityChangeConfirmation | null>(null);
  const debouncedSearch = useDebounce(search, 300);

  const { entityId, contextId, entityType, language } = config;

  const { data: assetsResponse, isLoading: isLoadingAssets } = useResourceLibraryAssets(
    {
      page,
      perPage: PER_PAGE,
      search: debouncedSearch || undefined,
      language,
    },
    { enabled: open && !assetToDelete },
  );

  const { data: usagesResponse, isLoading: isLoadingUsages } = useResourceLibraryAssetUsages(
    { id: assetToDelete?.id, language },
    { enabled: open && Boolean(assetToDelete) },
  );
  const { mutateAsync: deleteAsset, isPending: isDeletingAsset } = useDeleteResourceLibraryAsset();
  const { mutateAsync: bulkUpdateVisibility, isPending: isBulkUpdatingVisibility } =
    useBulkUpdateResourceLibraryAssetVisibility();

  const {
    askForDisplayMode,
    handleUploadToLibrary,
    isUploadingToLibrary,
    uploadDisplayModeDialog,
  } = useAssetLibraryUploadHandler({ entityType, entityId, contextId, language });

  const hasEntity = Boolean(entityId);
  const canUseLibrary = Boolean(entityId || contextId);
  const canUploadToLibrary = canUseLibrary;
  const canInsertAsset = canUseLibrary;
  const assets = assetsResponse?.data ?? [];
  const selectedAssetIds = Object.keys(rowSelection).filter((assetId) => rowSelection[assetId]);
  const usages = usagesResponse?.data ?? [];
  const totalAssets = assetsResponse?.pagination.totalItems ?? 0;
  const isMutating = isDeletingAsset || isBulkUpdatingVisibility || isUploadingToLibrary;

  const resetDialog = (nextOpen: boolean) => {
    if (!nextOpen) {
      setAssetToDelete(null);
      setSearch("");
      setPage(1);
      setRowSelection({});
    }
    onOpenChange(nextOpen);
  };

  const getDisplayMode = async (
    resourceType: ReturnType<typeof getRichTextResourceTypeFromAsset>,
    fileName: string,
  ): Promise<RichTextResourceDisplayMode | null> => {
    if (!richTextResourceTypeNeedsDisplayMode(resourceType)) return "preview";
    return askForDisplayMode(fileName);
  };

  const handleInsert = async (asset: ResourceLibraryAsset) => {
    if (!canInsertAsset) {
      toast({
        description: t("richText.assetLibrary.disabledUntilSaved"),
        variant: "destructive",
      });
      return;
    }

    const resourceType = getRichTextResourceTypeFromAsset(asset);
    const displayName = getAssetDisplayName(asset);
    const displayMode = await getDisplayMode(resourceType, displayName);

    if (!displayMode) return;

    insertResourceIntoEditor({
      editor,
      resourceId: asset.id,
      entityType,
      file: { name: displayName },
      resourceType,
      displayMode,
      videoProvider: asset.videoProvider,
    });

    resetDialog(false);
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;

    if (!files?.length) return;

    if (!canUploadToLibrary) {
      toast({
        description: t("richText.assetLibrary.disabledUntilSaved"),
        variant: "destructive",
      });
      return;
    }

    await Promise.allSettled(Array.from(files).map((file) => handleUploadToLibrary(file)));

    if (uploadInputRef.current) {
      uploadInputRef.current.value = "";
    }
  };

  const handleDelete = async () => {
    if (!assetToDelete) return;

    await deleteAsset({ ...assetToDelete, usages });
    setAssetToDelete(null);
  };

  const requestVisibilityChange = async ({
    resourceIds,
    visibility,
    clearSelection,
  }: Omit<VisibilityChangeConfirmation, "affectedUsedAssetCount">) => {
    const { data } = await bulkUpdateVisibility({
      resourceIds,
      visibility,
    });

    if (data.requiresConfirmation) {
      setVisibilityChangeConfirmation({
        resourceIds,
        visibility,
        affectedUsedAssetCount: data.affectedUsedAssetCount,
        clearSelection,
      });

      return;
    }

    if (clearSelection) setRowSelection({});
  };

  const handleVisibilityChange = async (asset: ResourceLibraryAsset) => {
    const visibility =
      asset.visibility === RESOURCE_VISIBILITY.PRIVATE
        ? RESOURCE_VISIBILITY.PUBLIC
        : RESOURCE_VISIBILITY.PRIVATE;

    await requestVisibilityChange({ resourceIds: [asset.id], visibility, clearSelection: false });
  };

  const handleBulkVisibilityChange = async (visibility: EditableResourceVisibility) => {
    const resourceIds = selectedAssetIds;
    if (!resourceIds.length) return;

    await requestVisibilityChange({ resourceIds, visibility, clearSelection: true });
  };

  const handleConfirmVisibilityChange = async () => {
    if (!visibilityChangeConfirmation) return;

    await bulkUpdateVisibility({
      resourceIds: visibilityChangeConfirmation.resourceIds,
      visibility: visibilityChangeConfirmation.visibility,
      confirmUsedAssetPrivacyChange: true,
    });

    if (visibilityChangeConfirmation.clearSelection) setRowSelection({});
    setVisibilityChangeConfirmation(null);
  };

  return (
    <>
      <AssetLibraryVisibilityConfirmationDialog
        confirmation={visibilityChangeConfirmation}
        isPending={isBulkUpdatingVisibility}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !isBulkUpdatingVisibility) setVisibilityChangeConfirmation(null);
        }}
        onConfirm={() => void handleConfirmVisibilityChange()}
      />
      <Dialog open={open} onOpenChange={resetDialog}>
        <DialogContent
          data-testid={RICH_TEXT_HANDLES.ASSET_LIBRARY_DIALOG}
          className="max-h-[90vh] max-w-4xl overflow-hidden"
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Folder className="size-5" aria-hidden />
              {t("richText.assetLibrary.title")}
            </DialogTitle>
            <DialogDescription>{t("richText.assetLibrary.description")}</DialogDescription>
          </DialogHeader>

          {assetToDelete ? (
            <AssetLibraryDeleteConfirmation
              asset={assetToDelete}
              usages={usages}
              isLoadingUsages={isLoadingUsages}
              isDeleting={isDeletingAsset}
              onBack={() => setAssetToDelete(null)}
              onCancel={() => setAssetToDelete(null)}
              onConfirm={() => void handleDelete()}
            />
          ) : (
            <AssetLibraryBrowser
              assets={assets}
              acceptedFileTypes={acceptedFileTypes}
              canDelete={hasEntity}
              canUseLibrary={canUseLibrary}
              canInsertAsset={canInsertAsset}
              canUploadToLibrary={canUploadToLibrary}
              currentPage={page}
              isLoadingAssets={isLoadingAssets}
              isMutating={isMutating}
              isUploadingToLibrary={isUploadingToLibrary}
              search={search}
              rowSelection={rowSelection}
              selectedAssetCount={selectedAssetIds.length}
              totalAssets={totalAssets}
              uploadInputRef={uploadInputRef}
              onDelete={setAssetToDelete}
              onInsert={(asset) => void handleInsert(asset)}
              onPageChange={setPage}
              onSearchChange={(nextSearch) => {
                setSearch(nextSearch);
                setPage(1);
              }}
              onRowSelectionChange={setRowSelection}
              onUpload={(event) => void handleUpload(event)}
              onVisibilityChange={(asset) => void handleVisibilityChange(asset)}
              onBulkVisibilityChange={(visibility) => void handleBulkVisibilityChange(visibility)}
            />
          )}
        </DialogContent>
      </Dialog>
      {uploadDisplayModeDialog}
    </>
  );
};
