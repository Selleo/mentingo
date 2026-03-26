import { useMutation } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

import type { SupportedLanguages } from "@repo/shared";

type PreviewNewsPayload = {
  newsId: string;
  language: SupportedLanguages;
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
