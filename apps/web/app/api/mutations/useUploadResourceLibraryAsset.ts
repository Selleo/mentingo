import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { RESOURCE_LIBRARY_ASSETS_QUERY_KEY } from "~/api/queries/useResourceLibraryAssets";
import { queryClient } from "~/api/queryClient";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { useToast } from "~/components/ui/use-toast";

import type { SupportedLanguages } from "@repo/shared";
import type { RichTextResourceLibraryEntityType } from "~/types/resourceLibrary";

type UploadAssetOptions = {
  file: File;
  entityType: RichTextResourceLibraryEntityType;
  entityId?: string;
  contextId?: string;
  language: SupportedLanguages;
  title?: string;
  description?: string;
};

export function useUploadResourceLibraryAsset() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async ({
      file,
      entityType,
      entityId,
      contextId,
      language,
      title,
      description,
    }: UploadAssetOptions) => {
      const response = await ApiClient.api.resourceLibraryControllerUploadAsset({
        file,
        entityType,
        language,
        title: title ?? file.name,
        description: description ?? file.name,
        ...(entityId ? { entityId } : {}),
        ...(contextId ? { contextId } : {}),
      });

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RESOURCE_LIBRARY_ASSETS_QUERY_KEY });
    },
    onError: (error) => {
      toast({
        description: getTranslatedApiErrorMessage(error, t, t("common.toast.somethingWentWrong")),
        variant: "destructive",
      });
    },
  });
}
