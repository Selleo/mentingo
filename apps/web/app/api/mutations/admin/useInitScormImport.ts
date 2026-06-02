import { useMutation } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

import type { InitScormImportBody, InitScormImportResponse } from "~/api/generated-api";

export function useInitScormImport() {
  return useMutation({
    mutationFn: async (payload: InitScormImportBody): Promise<InitScormImportResponse> => {
      const response = await ApiClient.api.scormControllerInitScormImport(payload);

      return response.data;
    },
  });
}
