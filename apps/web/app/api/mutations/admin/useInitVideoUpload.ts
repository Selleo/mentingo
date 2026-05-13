import { useMutation, useQueryClient } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";
import { RESOURCE_LIBRARY_ASSETS_QUERY_KEY } from "~/api/queries/useResourceLibraryAssets";

import type { InitVideoUploadBody, InitVideoUploadResponse } from "~/api/generated-api";

export function useInitVideoUpload() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: InitVideoUploadBody): Promise<InitVideoUploadResponse> => {
      const response = await ApiClient.api.fileControllerInitVideoUpload(payload);

      return response.data;
    },
    onSuccess: (response) => {
      if (response.resourceId) {
        queryClient.invalidateQueries({ queryKey: RESOURCE_LIBRARY_ASSETS_QUERY_KEY });
      }
    },
  });
}
