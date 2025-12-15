import { useMutation, useQueryClient } from "@tanstack/react-query";

import { ApiClient } from "../api-client";
import { newsQueryOptions } from "../queries/useNews";
import { NEWS_LIST_QUERY_KEY } from "../queries/useNewsList";

type UploadNewsFileOptions = {
  id: string;
  file: File;
  language: "en" | "pl";
  title: string;
  description: string;
};

export function useUploadNewsFile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, file, language, title, description }: UploadNewsFileOptions) => {
      const data = {
        file,
        language,
        title,
        description,
      };
      const response = await ApiClient.api.newsControllerUploadFileToNews(id, data);

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
        console.error("Error uploading news file:", error.message);
      } else {
        console.error("Unexpected error while uploading news file.");
      }
    },
  });
}
