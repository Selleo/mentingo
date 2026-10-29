import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { CONFIGURATION_STATE_QUERY_KEY } from "~/api/queries/admin/useConfigurationState";
import { LOGIN_METHOD_SETUP_QUERY_KEY } from "~/api/queries/admin/useLoginMethodSetup";
import { liveKitConfiguredQueryOptions } from "~/api/queries/useLiveKitConfigured";
import { LOGIN_METHODS_QUERY_KEY } from "~/api/queries/useLoginMethods";
import { ssoEnabledQueryOptions } from "~/api/queries/useSSOEnabled";
import { stripeConfiguredQueryOptions } from "~/api/queries/useStripeConfigured";
import { stripePublishableKeyQueryOptions } from "~/api/queries/useStripePublishableKey";
import { queryClient } from "~/api/queryClient";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
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
    onSuccess: async () => {
      toast({
        variant: "default",
        description: t("adminEnvsView.updateSuccessful"),
      });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: CONFIGURATION_STATE_QUERY_KEY }),
        queryClient.invalidateQueries(stripeConfiguredQueryOptions()),
        queryClient.invalidateQueries({ queryKey: ["secrets"] }),
        queryClient.invalidateQueries({ queryKey: ["phishing"] }),
        queryClient.invalidateQueries({ queryKey: ssoEnabledQueryOptions().queryKey }),
        queryClient.invalidateQueries({ queryKey: LOGIN_METHODS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: LOGIN_METHOD_SETUP_QUERY_KEY }),
        queryClient.invalidateQueries(stripePublishableKeyQueryOptions()),
        queryClient.invalidateQueries(liveKitConfiguredQueryOptions),
      ]);
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        description: getTranslatedApiErrorMessage(error, t, "adminEnvsView.overview.saveError"),
      });
    },
  });
}
