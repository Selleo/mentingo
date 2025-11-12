import { useMutation } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";
import { CONFIGURATION_STATE_QUERY_KEY } from "~/api/queries/admin/useConfigurationState";
import { queryClient } from "~/api/queryClient";

export function useUpdateConfigWarningDismissed() {
  return useMutation({
    mutationFn: async (dismissed: boolean) => {
      const { data } = await ApiClient.api.settingsControllerUpdateConfigWarningDismissed({
        dismissed,
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONFIGURATION_STATE_QUERY_KEY });
    },
  });
}
