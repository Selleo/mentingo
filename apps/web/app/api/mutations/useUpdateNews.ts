import { useMutation, useQueryClient } from "@tanstack/react-query";

import { ApiClient } from "../api-client";
import { NEWS_QUERY_KEY } from "../queries/useNews";
import { NEWS_LIST_QUERY_KEY } from "../queries/useNewsList";
import { RESOURCE_LIBRARY_ASSETS_QUERY_KEY } from "../queries/useResourceLibraryAssets";

import type { SupportedLanguages } from "@repo/shared";

type GeneratedUpdateNewsPayload = Parameters<typeof ApiClient.api.newsControllerUpdateNews>[1];

export type UpdateNewsPayload = GeneratedUpdateNewsPayload &
  Partial<Record<`cover.${SupportedLanguages}`, File>>;

type UpdateNewsOptions = {
  id: string;
  data: UpdateNewsPayload;
  language?: SupportedLanguages;
};

export function useUpdateNews() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: UpdateNewsOptions) => {
      const response = await ApiClient.api.newsControllerUpdateNews(id, data);
      return response.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: [...NEWS_QUERY_KEY, variables.id],
      });
      queryClient.invalidateQueries({ queryKey: NEWS_LIST_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: RESOURCE_LIBRARY_ASSETS_QUERY_KEY });
    },
    onError: (error) => {
      if (error instanceof Error) {
        console.error("Error updating news:", error.message);
      } else {
        console.error("Unexpected error while updating news.");
      }
    },
  });
}
