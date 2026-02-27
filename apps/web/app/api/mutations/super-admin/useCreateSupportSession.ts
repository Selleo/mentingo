import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { useToast } from "~/components/ui/use-toast";

import type { AxiosError } from "axios";
import type { ApiErrorResponse } from "~/api/types";

type CreateSupportSessionOptions = {
  tenantId: string;
};

export function useCreateSupportSession() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async ({ tenantId }: CreateSupportSessionOptions) => {
      const { data } = await ApiClient.api.tenantsControllerCreateSupportSession(tenantId);
      return data;
    },
    onError: (error: AxiosError) => {
      const { message } = (error.response?.data as ApiErrorResponse) ?? {
        message: "supportMode.errors.generic",
      };
      toast({ description: t(message), variant: "destructive" });
    },
  });
}
