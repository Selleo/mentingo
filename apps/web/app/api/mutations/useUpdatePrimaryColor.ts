import { useMutation } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

type UpdatePrimaryColorOptions = {
  primaryColor: string;
};

export function useUpdatePrimaryColor() {
  return useMutation({
    mutationFn: async (options: UpdatePrimaryColorOptions) => {
      const response = await ApiClient.api.settingsControllerUpdatePrimaryColor({
        primaryColor: options.primaryColor,
      });

      return response.data;
    },
  });
}
