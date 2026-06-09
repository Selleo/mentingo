import { ENTITY_TYPES } from "@repo/shared";
import { Folder, Search, UploadCloud } from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useInitVideoUpload } from "~/api/mutations/admin/useInitVideoUpload";
import { useDeleteResourceLibraryAsset } from "~/api/mutations/useDeleteResourceLibraryAsset";
import { useUploadResourceLibraryAsset } from "~/api/mutations/useUploadResourceLibraryAsset";
import {
  RESOURCE_LIBRARY_ASSETS_QUERY_KEY,
  useResourceLibraryAssets,
} from "~/api/queries/useResourceLibraryAssets";
import { useResourceLibraryAssetUsages } from "~/api/queries/useResourceLibraryAssetUsages";
import { queryClient } from "~/api/queryClient";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { Pagination } from "~/components/Pagination/Pagination";
import { insertResourceIntoEditor } from "~/components/RichText/utils/insertResourceIntoEditor";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { useToast } from "~/components/ui/use-toast";
import { buildRichTextFileUploadHandler } from "~/hooks/buildRichTextFileUploadHandler";
import { useDebounce } from "~/hooks/useDebounce";
import { useTusVideoUpload } from "~/hooks/useTusVideoUpload";
import { useUploadDisplayModeDialog } from "~/hooks/useUploadDisplayModeDialog";
import { cn } from "~/lib/utils";

import { RICH_TEXT_HANDLES } from "../../../../e2e/data/common/handles";

import {
  getAssetDisplayName,
  getRichTextResourceTypeFromAsset,
  richTextResourceTypeNeedsDisplayMode,
} from "./assetLibrary.utils";
import { AssetLibraryAssetList } from "./AssetLibraryAssetList";
import { AssetLibraryDeleteConfirmation } from "./AssetLibraryDeleteConfirmation";

import type { SupportedLanguages } from "@repo/shared";
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
  const debouncedSearch = useDebounce(search, 300);
  const { askForDisplayMode, dialog: uploadDisplayModeDialog } = useUploadDisplayModeDialog();

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
  const { mutateAsync: initVideoUpload, isPending: isInitializingVideoUpload } =
    useInitVideoUpload();
  const { getSessionForFile, uploadVideo, isUploading: isUploadingVideo } = useTusVideoUpload();
  const { mutateAsync: uploadAsset, isPending: isUploadingAsset } = useUploadResourceLibraryAsset();
  const { mutateAsync: deleteAsset, isPending: isDeletingAsset } = useDeleteResourceLibraryAsset();

  const hasEntity = Boolean(entityId);
  const canUseLibrary = Boolean(entityId || contextId);
  const canUploadToLibrary = canUseLibrary;
  const canInsertAsset = canUseLibrary;
  const assets = assetsResponse?.data ?? [];
  const usages = usagesResponse?.data ?? [];
  const totalAssets = assetsResponse?.pagination.totalItems ?? 0;
  const isUploadingToLibrary = isUploadingAsset || isInitializingVideoUpload || isUploadingVideo;

  const isMutating =
    isUploadingAsset || isDeletingAsset || isInitializingVideoUpload || isUploadingVideo;

  const resetDialog = (nextOpen: boolean) => {
    if (!nextOpen) {
      setAssetToDelete(null);
      setSearch("");
      setPage(1);
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

  const getVideoResource = () =>
    entityType === ENTITY_TYPES.LESSON ? "lesson-content" : entityType;

  const handleUploadToLibrary = buildRichTextFileUploadHandler({
    entityType,
    getVideoSessionForFile: (file) =>
      getSessionForFile({
        file,
        init: () =>
          initVideoUpload({
            filename: file.name,
            sizeBytes: file.size,
            mimeType: file.type,
            title: file.name,
            resource: getVideoResource(),
            contextId,
            entityId,
            entityType,
            linkToEntity: false,
          }),
      }),
    uploadVideo: (args) =>
      uploadVideo({
        ...args,
        onUploaded: () => {
          args.onUploaded?.();
          void queryClient.invalidateQueries({ queryKey: RESOURCE_LIBRARY_ASSETS_QUERY_KEY });
        },
      }),
    uploadResourceFile: async (file) => {
      const response = await uploadAsset({
        file,
        entityType,
        entityId,
        contextId,
        language,
      });

      return response.data.resourceId;
    },
    askForDisplayMode,
    onVideoUploadError: (error) => {
      toast({
        description: getTranslatedApiErrorMessage(error, t, t("uploadFile.toast.videoFailed")),
        variant: "destructive",
      });
    },
    fallbackUploadErrorMessage: t("common.toast.somethingWentWrong"),
    insertOnUpload: false,
  });

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
    });

    resetDialog(false);
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) return;

    if (uploadInputRef.current) uploadInputRef.current.value = "";

    if (!canUploadToLibrary) {
      toast({
        description: t("richText.assetLibrary.disabledUntilSaved"),
        variant: "destructive",
      });
      return;
    }

    await handleUploadToLibrary(file);
  };

  const handleDelete = async () => {
    if (!assetToDelete) return;

    await deleteAsset({ ...assetToDelete, usages });
    setAssetToDelete(null);
  };

  return (
    <>
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
                    onChange={(event) => {
                      setSearch(event.target.value);
                      setPage(1);
                    }}
                    placeholder={t("richText.assetLibrary.searchPlaceholder")}
                    className="pl-9"
                  />
                </div>
                <Input
                  data-testid={RICH_TEXT_HANDLES.ASSET_LIBRARY_UPLOAD_INPUT}
                  ref={uploadInputRef}
                  type="file"
                  className="hidden"
                  accept={acceptedFileTypes.join(",")}
                  onChange={(event) => void handleUpload(event)}
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
                  {isUploadingToLibrary
                    ? t("common.button.uploading")
                    : t("richText.assetLibrary.upload")}
                </Button>
              </div>
              <AssetLibraryAssetList
                assets={assets}
                isLoading={isLoadingAssets}
                canInsert={canInsertAsset}
                canDelete={hasEntity}
                isMutating={isMutating}
                onInsert={(asset) => void handleInsert(asset)}
                onDelete={setAssetToDelete}
              />
              <Pagination
                className="px-0"
                emptyDataClassName="hidden"
                totalItems={totalAssets}
                itemsPerPage={PER_PAGE}
                currentPage={page}
                canChangeItemsPerPage={false}
                onPageChange={setPage}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
      {uploadDisplayModeDialog}
    </>
  );
};
