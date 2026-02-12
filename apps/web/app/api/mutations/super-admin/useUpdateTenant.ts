import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { SUPER_ADMIN_TENANT_QUERY_KEY } from "~/api/queries/super-admin/useTenant";
import { SUPER_ADMIN_TENANTS_QUERY_KEY } from "~/api/queries/super-admin/useTenants";
import { queryClient } from "~/api/queryClient";
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
    onSuccess: async (_data, options) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: SUPER_ADMIN_TENANTS_QUERY_KEY }),
        queryClient.invalidateQueries({
          queryKey: [...SUPER_ADMIN_TENANT_QUERY_KEY, options.id],
        }),
      ]);
      toast({ description: t("superAdminTenantsView.toast.tenantUpdatedSuccessfully") });
    },
    onError: (error: AxiosError) => {
      const { message } = error.response?.data as ApiErrorResponse;
      toast({ description: t(message), variant: "destructive" });
    },
  });
}
