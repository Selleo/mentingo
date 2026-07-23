import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { SUPER_ADMIN_TENANTS_QUERY_KEY } from "~/api/queries/super-admin/useTenants";
import { queryClient } from "~/api/queryClient";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { useToast } from "~/components/ui/use-toast";

type DeleteTenantOptions = {
  id: string;
};

export function useDeleteTenant() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async ({ id }: DeleteTenantOptions) => {
      await ApiClient.api.tenantsControllerDeleteTenantById(id);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: SUPER_ADMIN_TENANTS_QUERY_KEY });
      toast({ description: t("superAdminTenantsView.toast.tenantDeletedSuccessfully") });
    },
    onError: (error: unknown) => {
      toast({
        description: getTranslatedApiErrorMessage(error, t, t("common.toast.somethingWentWrong")),
        variant: "destructive",
      });
    },
  });
}
