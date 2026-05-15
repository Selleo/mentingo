import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { RESOURCE_LIBRARY_ASSETS_QUERY_KEY } from "~/api/queries/useResourceLibraryAssets";
import { queryClient } from "~/api/queryClient";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { useToast } from "~/components/ui/use-toast";

import type { RichTextResourceLibraryEntityType } from "~/types/resourceLibrary";

type UnlinkAssetOptions = {
  id: string;
  entityId: string;
  entityType: RichTextResourceLibraryEntityType;
};

export function useUnlinkResourceLibraryAsset() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async ({ id, entityId, entityType }: UnlinkAssetOptions) => {
      const response = await ApiClient.api.resourceLibraryControllerUnlinkAsset(id, {
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
