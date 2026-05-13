import { useMutation, useQueryClient } from "@tanstack/react-query";

import { ApiClient } from "../api-client";
import { RESOURCE_LIBRARY_ASSETS_QUERY_KEY } from "../queries/useResourceLibraryAssets";

import type { SupportedLanguages } from "@repo/shared";

type UploadNewsFileOptions = {
  id: string;
  file: File;
  language: SupportedLanguages;
  title: string;
  description: string;
};

export function useUploadNewsFile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, file, language, title, description }: UploadNewsFileOptions) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("language", language);
      formData.append("title", title);
      formData.append("description", description);

      const response = await ApiClient.api.newsControllerUploadFileToNews(
        id,
        formData as unknown as {
          file: File;
          language: SupportedLanguages;
          title: string;
          description: string;
        },
        {
          headers: { "Content-Type": "multipart/form-data" },
          transformRequest: () => formData,
        },
      );

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RESOURCE_LIBRARY_ASSETS_QUERY_KEY });
      // queryClient.invalidateQueries({
      //   queryKey: newsQueryOptions(variables.id, { language: variables.language }).queryKey,
      // });
      // queryClient.invalidateQueries({ queryKey: NEWS_LIST_QUERY_KEY });
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
