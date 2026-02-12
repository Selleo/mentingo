import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { INTEGRATION_API_KEY_QUERY_KEY } from "~/api/queries/admin/useIntegrationApiKey";
import { queryClient } from "~/api/queryClient";
import { useToast } from "~/components/ui/use-toast";

import type { AxiosError } from "axios";
import type { ApiErrorResponse } from "~/api/types";

export function useRotateIntegrationApiKey() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async () => {
      const response = await ApiClient.api.integrationAdminControllerRotateKey();

      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [INTEGRATION_API_KEY_QUERY_KEY] });
      toast({
        variant: "default",
        description: t("integrationApiKey.toast.rotateSuccess"),
      });
    },
    onError: (error: AxiosError) => {
      const { message } = error.response?.data as ApiErrorResponse;
      toast({
        variant: "destructive",
        description: t(message || "integrationApiKey.toast.rotateError"),
      });
    },
  });
}
