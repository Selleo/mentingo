import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { useToast } from "~/components/ui/use-toast";

import type { AxiosError } from "axios";
import type { UpdateTenantByIdBody } from "~/api/generated-api";
import type { ApiErrorResponse } from "~/api/types";

type UpdateTenantOptions = {
  id: string;
  data: UpdateTenantByIdBody;
};

export function useUpdateTenant() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (options: UpdateTenantOptions) => {
      const response = await ApiClient.api.tenantsControllerUpdateTenantById(
        options.id,
        options.data,
      );
      return response.data;
    },
    onSuccess: () => {
      toast({ description: t("superAdminTenantsView.toast.tenantUpdatedSuccessfully") });
    },
    onError: (error: AxiosError) => {
      const { message } = error.response?.data as ApiErrorResponse;
      toast({ description: t(message), variant: "destructive" });
    },
  });
}
