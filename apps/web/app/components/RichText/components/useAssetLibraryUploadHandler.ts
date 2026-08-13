import { ENTITY_TYPES, type SupportedLanguages } from "@repo/shared";
import { useTranslation } from "react-i18next";

import { useInitVideoUpload } from "~/api/mutations/admin/useInitVideoUpload";
import { useUploadResourceLibraryAsset } from "~/api/mutations/useUploadResourceLibraryAsset";
import { RESOURCE_LIBRARY_ASSETS_QUERY_KEY } from "~/api/queries/useResourceLibraryAssets";
import { queryClient } from "~/api/queryClient";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { useToast } from "~/components/ui/use-toast";
import { buildRichTextFileUploadHandler } from "~/hooks/buildRichTextFileUploadHandler";
import { useTusVideoUpload } from "~/hooks/useTusVideoUpload";
import { useUploadDisplayModeDialog } from "~/hooks/useUploadDisplayModeDialog";

import type { RichTextResourceLibraryEntityType } from "~/types/resourceLibrary";

type UseAssetLibraryUploadHandlerParams = {
  entityType: RichTextResourceLibraryEntityType;
  entityId?: string;
  contextId?: string;
  language: SupportedLanguages;
};

export const useAssetLibraryUploadHandler = ({
  entityType,
  entityId,
  contextId,
  language,
}: UseAssetLibraryUploadHandlerParams) => {
  const { t } = useTranslation();
  const { toast } = useToast();

  const { askForDisplayMode, dialog: uploadDisplayModeDialog } = useUploadDisplayModeDialog();
  const { mutateAsync: initVideoUpload, isPending: isInitializingVideoUpload } =
    useInitVideoUpload();
  const { getSessionForFile, uploadVideo, isUploading: isUploadingVideo } = useTusVideoUpload();
  const { mutateAsync: uploadAsset, isPending: isUploadingAsset } = useUploadResourceLibraryAsset();

  const videoResource = entityType === ENTITY_TYPES.LESSON ? "lesson-content" : entityType;

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
            resource: videoResource,
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
      const {
        data: { resourceId },
      } = await uploadAsset({
        file,
        entityType,
        entityId,
        contextId,
        language,
      });

      return resourceId;
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

  return {
    askForDisplayMode,
    handleUploadToLibrary,
    isUploadingToLibrary: isUploadingAsset || isInitializingVideoUpload || isUploadingVideo,
    uploadDisplayModeDialog,
  };
};
