import { useMutation, useQueryClient } from "@tanstack/react-query";

import { ApiClient } from "../api-client";
import { NEWS_QUERY_KEY } from "../queries/useNews";
import { NEWS_LIST_QUERY_KEY } from "../queries/useNewsList";

type DeleteNewsOptions = {
  id: string;
};

export function useDeleteNews() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id }: DeleteNewsOptions) => {
      const response = await ApiClient.api.newsControllerDeleteNews(id);
      return response.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [...NEWS_QUERY_KEY, variables.id] });
      queryClient.invalidateQueries({ queryKey: NEWS_LIST_QUERY_KEY });
    },
    onError: (error) => {
      if (error instanceof Error) {
        console.error("Error deleting news:", error.message);
      } else {
        console.error("Unexpected error while deleting news.");
      }
    },
  });
}
