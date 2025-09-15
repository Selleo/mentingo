import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { globalSettingsQueryOptions } from "~/api/queries/useGlobalSettings";
import { queryClient } from "~/api/queryClient";
import { useToast } from "~/components/ui/use-toast";

import type { UpdateMFAEnforcedRolesBody } from "~/api/generated-api";

export function useUpdateMFAEnforcedRoles() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (data: UpdateMFAEnforcedRolesBody) => {
      const response = await ApiClient.api.settingsControllerUpdateMfaEnforcedRoles(data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(globalSettingsQueryOptions);
      toast({
        variant: "default",
        description: t("MFAEnforcementView.toast.mfaEnforcementUpdatedSuccessfully"),
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        description: t("MFAEnforcementView.toast.mfaEnforcementUpdateFailed"),
      });
    },
  });
}
