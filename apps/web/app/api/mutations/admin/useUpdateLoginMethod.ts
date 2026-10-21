import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { CONFIGURATION_STATE_QUERY_KEY } from "~/api/queries/admin/useConfigurationState";
import { LOGIN_METHOD_SETUP_QUERY_KEY } from "~/api/queries/admin/useLoginMethodSetup";
import { LOGIN_METHODS_QUERY_KEY } from "~/api/queries/useLoginMethods";
import { ssoEnabledQueryOptions } from "~/api/queries/useSSOEnabled";
import { queryClient } from "~/api/queryClient";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { useToast } from "~/components/ui/use-toast";

import type { UpdateLoginMethodBody } from "~/api/generated-api";

export function useUpdateLoginMethod() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (data: UpdateLoginMethodBody) => {
      const response = await ApiClient.api.envControllerUpdateLoginMethod(data);

      return response.data;
    },
    onSuccess: async (data) => {
      queryClient.setQueryData(LOGIN_METHOD_SETUP_QUERY_KEY, data);

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: LOGIN_METHODS_QUERY_KEY }),
        queryClient.invalidateQueries(ssoEnabledQueryOptions()),
        queryClient.invalidateQueries({ queryKey: ["secrets"] }),
        queryClient.invalidateQueries({ queryKey: CONFIGURATION_STATE_QUERY_KEY }),
      ]);
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        description: getTranslatedApiErrorMessage(error, t, t("loginMethods.errors.save")),
      });
    },
  });
}
