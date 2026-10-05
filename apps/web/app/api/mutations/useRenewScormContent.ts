import { useMutation } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

export function useRenewScormContent() {
  return useMutation({
    mutationFn: async (token: string) => {
      await ApiClient.api.scormControllerRenewContent({ token });
    },
  });
}
