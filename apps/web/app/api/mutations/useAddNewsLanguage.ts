import { useMutation, useQueryClient } from "@tanstack/react-query";

import { ApiClient } from "../api-client";
import { newsQueryOptions } from "../queries/useNews";
import { NEWS_LIST_QUERY_KEY } from "../queries/useNewsList";

import type { AddNewLanguageBody } from "../generated-api";

type AddNewsLanguageOptions = {
  id: string;
  data: AddNewLanguageBody;
  language?: "en" | "pl";
};

export function useAddNewsLanguage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: AddNewsLanguageOptions) => {
      const response = await ApiClient.api.newsControllerAddNewLanguage(id, data);
      return response.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: newsQueryOptions(variables.id, { language: variables.language }).queryKey,
      });
      queryClient.invalidateQueries({ queryKey: NEWS_LIST_QUERY_KEY });
    },
    onError: (error) => {
      if (error instanceof Error) {
        console.error("Error adding news language:", error.message);
      } else {
        console.error("Unexpected error while adding news language.");
      }
    },
  });
}

