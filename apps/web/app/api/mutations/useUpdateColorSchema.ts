import { useMutation } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

import type { UpdateColorSchemaBody } from "../generated-api";

export function useUpdateColorSchema() {
  return useMutation({
    mutationFn: async (colorSchema: UpdateColorSchemaBody) => {
      const response = await ApiClient.api.settingsControllerUpdateColorSchema(colorSchema);

      return response.data;
    },
  });
}
