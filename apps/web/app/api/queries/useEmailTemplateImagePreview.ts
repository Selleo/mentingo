import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

export const EMAIL_TEMPLATE_IMAGE_PREVIEW_QUERY_KEY = ["email-template-image-preview"] as const;

export function useEmailTemplateImagePreview(src: string) {
  return useQuery({
    queryKey: [...EMAIL_TEMPLATE_IMAGE_PREVIEW_QUERY_KEY, src],
    enabled: src.startsWith("asset:"),
    staleTime: 30 * 60 * 1000,
    refetchInterval: 30 * 60 * 1000,
    retry: false,
    queryFn: async () =>
      (await ApiClient.api.emailTemplateControllerGetEmailTemplateImage(src.slice("asset:".length)))
        .data.data.previewUrl,
  });
}
