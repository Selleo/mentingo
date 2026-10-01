import { useMutation } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

import { useEmailTemplateMutationFeedback } from "./useEmailTemplateMutationFeedback";

export function useUploadEmailTemplateImage() {
  const feedback = useEmailTemplateMutationFeedback("emailTemplates.ui.uploaded", false);
  return useMutation({
    mutationFn: async (file: File) =>
      (await ApiClient.api.emailTemplateControllerUploadEmailTemplateImage({ file })).data.data,
    ...feedback,
  });
}
