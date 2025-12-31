import { useMutation } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

import type { InitVideoUploadBody, InitVideoUploadResponse } from "~/api/generated-api";

export function useInitVideoUpload() {
  return useMutation({
    mutationFn: async (payload: InitVideoUploadBody): Promise<InitVideoUploadResponse> => {
      const response = await ApiClient.api.fileControllerInitVideoUpload(payload);

      return response.data;
    },
  });
}
