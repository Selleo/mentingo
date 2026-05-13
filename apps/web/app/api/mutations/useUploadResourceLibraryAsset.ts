import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { RESOURCE_LIBRARY_ASSETS_QUERY_KEY } from "~/api/queries/useResourceLibraryAssets";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { useToast } from "~/components/ui/use-toast";

import type { EntityType, SupportedLanguages } from "@repo/shared";

type RichTextEntityType = Extract<EntityType, "lesson" | "articles" | "news">;

type UploadAssetOptions = {
  file: File;
  entityType: RichTextEntityType;
  entityId?: string;
  contextId?: string;
  language: SupportedLanguages;
  title?: string;
  description?: string;
};

export function useUploadResourceLibraryAsset() {
  const queryClient = useQueryClient();
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
