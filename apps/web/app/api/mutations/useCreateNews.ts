import { useMutation, useQueryClient } from "@tanstack/react-query";

import { ApiClient } from "../api-client";
import { NEWS_LIST_QUERY_KEY } from "../queries/useNewsList";

import type { CreateNewsBody } from "../generated-api";

export function useCreateNews() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateNewsBody) => {
      const response = await ApiClient.api.newsControllerCreateNews(data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NEWS_LIST_QUERY_KEY });
    },
    onError: (error) => {
      if (error instanceof Error) {
        console.error("Error creating news:", error.message);
      } else {
        console.error("Unexpected error while creating news.");
      }
    },
  });
}
