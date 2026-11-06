import { useMutation } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

export function useRenewScormContent() {
  return useMutation({
    mutationFn: async (token: string) => {
      const response = await ApiClient.api.scormControllerRenewScormContent({ token });
      return response.data.data;
    },
    retry: 2,
  });
}
