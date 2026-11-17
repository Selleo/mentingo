import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { INTEGRATION_API_KEYS_QUERY_KEY } from "~/api/queries/admin/useIntegrationApiKeys";
import { queryClient } from "~/api/queryClient";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { useToast } from "~/components/ui/use-toast";

export function useRevokeIntegrationApiKey() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (keyId: string) => {
      await ApiClient.api.integrationAdminControllerRevokeKey(keyId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [INTEGRATION_API_KEYS_QUERY_KEY] });
      toast({ description: t("integrationApiKey.toast.revokeSuccess") });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        description: getTranslatedApiErrorMessage(
          error,
          t,
          t("integrationApiKey.toast.revokeError"),
        ),
      });
    },
  });
}
