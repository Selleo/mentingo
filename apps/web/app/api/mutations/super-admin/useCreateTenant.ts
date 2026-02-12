import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { SUPER_ADMIN_TENANTS_QUERY_KEY } from "~/api/queries/super-admin/useTenants";
import { queryClient } from "~/api/queryClient";
import { useToast } from "~/components/ui/use-toast";

import type { AxiosError } from "axios";
import type { CreateTenantBody } from "~/api/generated-api";
import type { ApiErrorResponse } from "~/api/types";

type CreateTenantOptions = {
  data: CreateTenantBody;
};

export function useCreateTenant() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (options: CreateTenantOptions) => {
      const response = await ApiClient.api.tenantsControllerCreateTenant(options.data);
      return response.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: SUPER_ADMIN_TENANTS_QUERY_KEY });
      toast({ description: t("superAdminTenantsView.toast.tenantCreatedSuccessfully") });
    },
    onError: (error: AxiosError) => {
      const { message } = error.response?.data as ApiErrorResponse;
      toast({ description: t(message), variant: "destructive" });
    },
  });
}
