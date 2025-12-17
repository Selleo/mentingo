import { useMutation, useQueryClient } from "@tanstack/react-query";

import { ApiClient } from "../api-client";
import { NEWS_QUERY_KEY } from "../queries/useNews";
import { NEWS_LIST_QUERY_KEY } from "../queries/useNewsList";

import type { UpdateNewsBody } from "../generated-api";

type UpdateNewsOptions = {
  id: string;
  data: UpdateNewsBody;
  language?: "en" | "pl";
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
