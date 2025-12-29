import { useMutation } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { CONFIGURATION_STATE_QUERY_KEY } from "~/api/queries/admin/useConfigurationState";
import { stripeConfiguredQueryOptions } from "~/api/queries/useStripeConfigured";
import { queryClient } from "~/api/queryClient";
import { useToast } from "~/components/ui/use-toast";

import type { BulkUpsertEnvBody } from "~/api/generated-api";

export function useBulkUpsertSecret() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (options: BulkUpsertEnvBody) => {
      const response = await ApiClient.api.envControllerBulkUpsertEnv(options);
      return response.data;
    },
    onSuccess: () => {
      toast({
        variant: "default",
        description: t("adminEnvsView.updateSuccessful"),
      });

      queryClient.invalidateQueries({ queryKey: CONFIGURATION_STATE_QUERY_KEY });
      queryClient.invalidateQueries(stripeConfiguredQueryOptions());
    },
    onError: (error) => {
      if (error instanceof AxiosError) {
        return toast({
          variant: "destructive",
          description: error.response?.data.message,
        });
      }
      toast({
        variant: "destructive",
        description: error.message,
      });
    },
  });
}
