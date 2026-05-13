import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { RESOURCE_LIBRARY_ASSETS_QUERY_KEY } from "~/api/queries/useResourceLibraryAssets";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { useToast } from "~/components/ui/use-toast";

import type { EntityType } from "@repo/shared";

type RichTextEntityType = Extract<EntityType, "lesson" | "articles" | "news">;

type LinkAssetOptions = {
  id: string;
  entityId: string;
  entityType: RichTextEntityType;
};

export function useLinkResourceLibraryAsset() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async ({ id, entityId, entityType }: LinkAssetOptions) => {
      const response = await ApiClient.api.resourceLibraryControllerLinkAsset(id, {
        entityId,
        entityType,
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
