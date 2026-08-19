import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { RESOURCE_LIBRARY_ASSETS_QUERY_KEY } from "~/api/queries/useResourceLibraryAssets";
import { queryClient } from "~/api/queryClient";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { useToast } from "~/components/ui/use-toast";

import type { BulkUpdateAssetVisibilityBody } from "~/api/generated-api";

export function useBulkUpdateResourceLibraryAssetVisibility() {
  const { t } = useTranslation();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (body: BulkUpdateAssetVisibilityBody) => {
      const response = await ApiClient.api.resourceLibraryControllerBulkUpdateAssetVisibility(body);
      return response.data;
    },
    onSuccess: ({ data }) => {
      if (data.requiresConfirmation) return;

      queryClient.invalidateQueries({ queryKey: RESOURCE_LIBRARY_ASSETS_QUERY_KEY });

      if (data.skippedIds.length) {
        toast({ description: t("richText.assetLibrary.visibility.bulkSkipped") });
      }
    },
    onError: (error) => {
      toast({
        description: getTranslatedApiErrorMessage(error, t, t("common.toast.somethingWentWrong")),
        variant: "destructive",
      });
    },
  });
}
