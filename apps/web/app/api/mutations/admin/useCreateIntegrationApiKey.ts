import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { INTEGRATION_API_KEYS_QUERY_KEY } from "~/api/queries/admin/useIntegrationApiKeys";
import { queryClient } from "~/api/queryClient";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { useToast } from "~/components/ui/use-toast";

import type { CreateKeyBody } from "~/api/generated-api";

export function useCreateIntegrationApiKey() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (body: CreateKeyBody) => {
      const response = await ApiClient.api.integrationAdminControllerCreateKey(body);

      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [INTEGRATION_API_KEYS_QUERY_KEY] });
      toast({ description: t("integrationApiKey.toast.createSuccess") });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        description: getTranslatedApiErrorMessage(
          error,
          t,
          t("integrationApiKey.toast.createError"),
        ),
      });
    },
  });
}
