import { useMutation } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

type PreviewNewsPayload = {
  newsId: string;
  language: "en" | "pl";
  content: string;
};

export function usePreviewNews() {
  return useMutation({
    mutationFn: async ({ newsId, language, content }: PreviewNewsPayload) => {
      const response = await ApiClient.api.newsControllerGenerateNewsPreview({
        newsId,
        language,
        content,
      });

      return response.data?.data?.parsedContent ?? content;
    },
  });
}
