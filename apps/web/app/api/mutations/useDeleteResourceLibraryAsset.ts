import { ENTITY_TYPES } from "@repo/shared";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { COURSE_QUERY_KEY } from "~/api/queries/admin/useBetaCourse";
import { ARTICLE_QUERY_KEY } from "~/api/queries/useArticle";
import { NEWS_QUERY_KEY } from "~/api/queries/useNews";
import { NEWS_LIST_QUERY_KEY } from "~/api/queries/useNewsList";
import { RESOURCE_LIBRARY_ASSETS_QUERY_KEY } from "~/api/queries/useResourceLibraryAssets";
import { queryClient } from "~/api/queryClient";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { useToast } from "~/components/ui/use-toast";

import type { GetAssetsResponse } from "~/api/generated-api";
import type { ResourceLibraryAssetUsage } from "~/api/queries/useResourceLibraryAssetUsages";

type ResourceLibraryAsset = GetAssetsResponse["data"][number];

type DeleteResourceLibraryAssetOptions = Pick<ResourceLibraryAsset, "id"> & {
  usages?: ResourceLibraryAssetUsage[];
};

const isArticleQueryForEntity = (queryKey: readonly unknown[], entityId: string) => {
  const [key, params] = queryKey;

  return (
    key === ARTICLE_QUERY_KEY &&
    typeof params === "object" &&
    params !== null &&
    "id" in params &&
    params.id === entityId
  );
};

export function useDeleteResourceLibraryAsset() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (asset: DeleteResourceLibraryAssetOptions) => {
      const response = await ApiClient.api.resourceLibraryControllerDeleteAsset(asset.id);
      return response.data;
    },
    onSuccess: (response, asset) => {
      queryClient.invalidateQueries({ queryKey: RESOURCE_LIBRARY_ASSETS_QUERY_KEY });
      asset.usages?.forEach((usage) => {
        if (usage.entityType === ENTITY_TYPES.LESSON) {
          queryClient.invalidateQueries({ queryKey: ["lesson", usage.entityId] });
          queryClient.invalidateQueries({ queryKey: [COURSE_QUERY_KEY] });
          queryClient.invalidateQueries({ queryKey: ["course"] });
        }

        if (usage.entityType === ENTITY_TYPES.ARTICLES) {
          queryClient.invalidateQueries({
            predicate: (query) => isArticleQueryForEntity(query.queryKey, usage.entityId),
          });
        }

        if (usage.entityType === ENTITY_TYPES.NEWS) {
          queryClient.invalidateQueries({ queryKey: [...NEWS_QUERY_KEY, usage.entityId] });
          queryClient.invalidateQueries({ queryKey: NEWS_LIST_QUERY_KEY });
        }
      });
      toast({
        description: t(response.data.message),
      });
    },
    onError: (error) => {
      toast({
        description: getTranslatedApiErrorMessage(error, t, t("common.toast.somethingWentWrong")),
        variant: "destructive",
      });
    },
  });
}
