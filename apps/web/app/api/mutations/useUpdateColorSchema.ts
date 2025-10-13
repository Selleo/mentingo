import { useMutation } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

type UpdateColorSchemaOptions = {
  primaryColor: string;
  contrastColor: string;
};

export function useUpdateColorSchema() {
  return useMutation({
    mutationFn: async (options: UpdateColorSchemaOptions) => {
      const response = await ApiClient.api.settingsControllerUpdateColorSchema({
        primaryColor: options.primaryColor,
        contrastColor: options.contrastColor,
      });

      return response.data;
    },
  });
}
